import { CredentialsProviderError } from "@smithy/property-provider";
import { AwsCredentialIdentity, Provider } from "@smithy/types";
import { RequestOptions } from "http";

import { httpRequest } from "./remoteProvider/httpRequest";
import { fromImdsCredentials, isImdsCredentials } from "./remoteProvider/ImdsCredentials";
import { providerConfigFromInit, RemoteProviderInit } from "./remoteProvider/RemoteProviderInit";
import { retry } from "./remoteProvider/retry";
import { InstanceMetadataCredentials } from "./types";
import { getInstanceMetadataEndpoint } from "./utils/getInstanceMetadataEndpoint";
import { staticStabilityProvider } from "./utils/staticStabilityProvider";

const IMDS_PATH = "/latest/meta-data/iam/security-credentials/";
const IMDS_TOKEN_PATH = "/latest/api/token";

/**
 * @internal
 *
 * Creates a credential provider that will source credentials from the EC2
 * Instance Metadata Service
 */
export const fromInstanceMetadata = (init: RemoteProviderInit = {}): Provider<InstanceMetadataCredentials> =>
  staticStabilityProvider(getInstanceImdsProvider(init), { logger: init.logger });

const getInstanceImdsProvider = (init: RemoteProviderInit) => {
  // when set to true, metadata service will not fetch token
  let disableFetchToken = false;
  const { timeout, maxRetries } = providerConfigFromInit(init);

  const getCredentials = async (maxRetries: number, options: RequestOptions) => {
    const profile = (
      await retry<string>(async () => {
        let profile: string;
        try {
          profile = await getProfile(options);
        } catch (err) {
          if (err.statusCode === 401) {
            disableFetchToken = false;
          }
          throw err;
        }
        return profile;
      }, maxRetries)
    ).trim();

    return retry(async () => {
      let creds: AwsCredentialIdentity;
      try {
        creds = await getCredentialsFromProfile(profile, options);
      } catch (err) {
        if (err.statusCode === 401) {
          disableFetchToken = false;
        }
        throw err;
      }
      return creds;
    }, maxRetries);
  };

  return async () => {
    const endpoint = await getInstanceMetadataEndpoint();
    if (disableFetchToken) {
      return getCredentials(maxRetries, { ...endpoint, timeout });
    } else {
      let token: string;
      try {
        token = (await getMetadataToken({ ...endpoint, timeout })).toString();
      } catch (error) {
        if (error?.statusCode === 400) {
          throw Object.assign(error, {
            message: "EC2 Metadata token request returned error",
          });
        } else if (error.message === "TimeoutError" || [403, 404, 405].includes(error.statusCode)) {
          disableFetchToken = true;
        }
        return getCredentials(maxRetries, { ...endpoint, timeout });
      }
      return getCredentials(maxRetries, {
        ...endpoint,
        headers: {
          "x-aws-ec2-metadata-token": token,
        },
        timeout,
      });
    }
  };
};

const getMetadataToken = async (options: RequestOptions) =>
  httpRequest({
    ...options,
    path: IMDS_TOKEN_PATH,
    method: "PUT",
    headers: {
      "x-aws-ec2-metadata-token-ttl-seconds": "21600",
    },
  });

const getProfile = async (options: RequestOptions) => (await httpRequest({ ...options, path: IMDS_PATH })).toString();

const getCredentialsFromProfile = async (profile: string, options: RequestOptions) => {
  const credsResponse = JSON.parse(
    (
      await httpRequest({
        ...options,
        path: IMDS_PATH + profile,
      })
    ).toString()
  );

  if (!isImdsCredentials(credsResponse)) {
    throw new CredentialsProviderError("Invalid response received from instance metadata service.");
  }

  return fromImdsCredentials(credsResponse);
};
