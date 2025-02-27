/*
 * Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

package software.amazon.smithy.typescript.codegen.endpointsV2;

import java.util.AbstractMap;
import java.util.Map;
import java.util.Optional;
import software.amazon.smithy.model.node.BooleanNode;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.model.node.StringNode;

/**
 * Owner for a parameter object node in the EndpointRuleSet.
 */
public class ParameterGenerator {
    private final String parameterName;
    private final Node param;
    private boolean required = false;
    private String tsParamType = "string";

    public ParameterGenerator(String key, Node param) {
        parameterName = key;
        this.param = param;

        ObjectNode paramNode = param.asObjectNode()
            .orElseThrow(() -> new RuntimeException("param node is not object node."));

        Optional<BooleanNode> requiredNode = paramNode.getBooleanMember("required");
        requiredNode.ifPresent(booleanNode -> required = booleanNode.getValue());

        Optional<StringNode> type = paramNode.getStringMember("type");

        if (type.isPresent()) {
            switch (type.get().getValue()) {
                case "String":
                    tsParamType = "string";
                    break;
                case "Boolean":
                    tsParamType = "boolean";
                    break;
                default:
                    // required by linter
            }
        }
    }

    public boolean isBuiltIn() {
        return param.expectObjectNode().containsMember("builtIn");
    }

    public boolean hasDefault() {
        return param.expectObjectNode().containsMember("default");
    }

    public String defaultAsCodeString() {
        if (!hasDefault()) {
            return "";
        }
        String buffer = "";
        buffer += parameterName;
        buffer += ": ";
        buffer += "options." + parameterName + " ?? ";
        ObjectNode paramNode = param.expectObjectNode();
        StringNode type = paramNode.expectStringMember("type");

        switch (type.getValue()) {
            case "String":
            case "string":
                buffer += "\"" + paramNode.expectStringMember("default").getValue() + "\"";
                break;
            case "Boolean":
            case "boolean":
                buffer += paramNode.expectBooleanMember("default").getValue() ? "true" : "false";
                break;
            default:
                throw new RuntimeException("Unhandled endpoint param type: " + type.getValue());
        }

        buffer += ",";
        return buffer;
    }

    public Map.Entry<String, String> getNameAndType() {
        return new AbstractMap.SimpleEntry<>(
            parameterName,
            tsParamType
        );
    }

    /**
     * Used to generate interface line for EndpointParameters.ts.
     */
    public String toCodeString(boolean isClientContextParam) {
        String buffer = "";
        buffer += parameterName;
        if (!required || hasDefault() || isClientContextParam) {
            buffer += "?";
        }
        buffer += ": ";

        if (parameterName.equals("endpoint")) {
            buffer += "string | Provider<string> | Endpoint | Provider<Endpoint> | EndpointV2 | Provider<EndpointV2>;";
        } else {
            if (isClientContextParam) {
                buffer += (tsParamType + "|" + "Provider<" + tsParamType + ">") + ";";
            } else {
                buffer += tsParamType + ";";
            }
        }
        return buffer;
    }
}
