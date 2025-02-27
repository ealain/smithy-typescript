import type { IncomingMessage } from "node:http";

import type { Client } from "../client";
import type { HttpHandlerOptions } from "../http";
import type { MetadataBearer } from "../response";
import type { SdkStream } from "../serde";
import type { StreamingBlobPayloadOutputTypes } from "../streaming-payload/streaming-blob-payload-output-types";
import type { BrowserClient, NodeJsClient } from "./client-payload-blob-type-narrow";

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// it should narrow operational methods and the generic send method

type MyInput = Partial<{
  a: boolean;
  b: boolean | number;
  c: boolean | number | string;
}>;

type MyOutput = {
  a: boolean;
  b: boolean | number;
  c: boolean | number | string;
  body?: StreamingBlobPayloadOutputTypes;
} & MetadataBearer;

type MyConfig = {
  version: number;
};

interface MyClient extends Client<MyInput, MyOutput, MyConfig> {
  getObject(args: MyInput, options?: HttpHandlerOptions): Promise<MyOutput>;
  getObject(args: MyInput, cb: (err: any, data?: MyOutput) => void): void;
  getObject(args: MyInput, options: HttpHandlerOptions, cb: (err: any, data?: MyOutput) => void): void;

  putObject(args: MyInput, options?: HttpHandlerOptions): Promise<MyOutput>;
  putObject(args: MyInput, cb: (err: any, data?: MyOutput) => void): void;
  putObject(args: MyInput, options: HttpHandlerOptions, cb: (err: any, data?: MyOutput) => void): void;
}

{
  interface NodeJsMyClient extends NodeJsClient<MyClient> {}
  const mockClient = (null as unknown) as NodeJsMyClient;
  const getObjectCall = () => mockClient.getObject({});

  type A = Awaited<ReturnType<typeof getObjectCall>>;
  type B = Omit<MyOutput, "body"> & { body?: SdkStream<IncomingMessage> };

  const assert1: Exact<A, B> = true as const;
}

{
  interface NodeJsMyClient extends BrowserClient<MyClient> {}
  const mockClient = (null as unknown) as NodeJsMyClient;
  const putObjectCall = () =>
    new Promise<B>((resolve) => {
      mockClient.putObject({}, (err: unknown, data) => {
        resolve(data!);
      });
    });

  type A = Awaited<ReturnType<typeof putObjectCall>>;
  type B = Omit<MyOutput, "body"> & { body?: SdkStream<ReadableStream> };

  const assert1: Exact<A, B> = true as const;
}

{
  interface NodeJsMyClient extends NodeJsClient<MyClient> {}
  const mockClient = (null as unknown) as NodeJsMyClient;
  const sendCall = () => mockClient.send(null as any, { abortSignal: null as any });

  type A = Awaited<ReturnType<typeof sendCall>>;
  type B = Omit<MyOutput, "body"> & { body?: SdkStream<IncomingMessage> };

  const assert1: Exact<A, B> = true as const;
}
