module.exports = Object.freeze({
    INVALID_OR_MISSING_OUTPUT_TYPE: {
        HTTP_CODE: 422,
        RESPONSE_CODE: -7,
        INFO: "invalid_or_missing_output_type"
    },
    INVALID_PARAMETER: {
        HTTP_CODE: 422,
        RESPONSE_CODE: -6,
        INFO: "invalid_parameter"
    },
    MULTI_PART_BODY_MISSING: {
        HTTP_CODE: 422,
        RESPONSE_CODE: -5,
        INFO: "multi_part_body_missing"
    },
    EXPIRED_ACCESS_CODE: {
        HTTP_CODE: 200,
        RESPONSE_CODE: -3,
        INFO: "expired_access_code"
    },
    INVALID_ACCESS_CODE: {
        HTTP_CODE: 200,
        RESPONSE_CODE: -2,
        INFO: "invalid_access_code"
    },
    MISSING_PARAMETER: {
        HTTP_CODE: 422,
        RESPONSE_CODE: -1,
        INFO: "missing_parameter"
    },
    NEW_PHONE: {
        HTTP_CODE: 200,
        RESPONSE_CODE: 1,
        INFO: "new_phone"
    },
    RETURNING_PHONE: {
        HTTP_CODE: 200,
        RESPONSE_CODE: 2,
        INFO: "returning_phone"
    },
    INVALID_PIN: {
        HTTP_CODE: 200,
        RESPONSE_CODE: 4,
        INFO: "invalid_pin"
    },
    INVALID_PHONE: {
        HTTP_CODE: 200,
        RESPONSE_CODE: 12,
        INFO: "invalid_phone"
    },
    INVALID_AUTH_KEY: {
        HTTP_CODE: 403,
        RESPONSE_CODE: 13,
        INFO: "invalid_auth_key"
    },
    INVALID_SPOT_ID: {
        HTTP_CODE: 404,
        RESPONSE_CODE: 15,
        INFO: "invalid_spot_id"
    },
    INVALID_BASIC_AUTH: {
        HTTP_CODE: 401,
        RESPONSE_CODE: 16,
        INFO: "invalid_basic_auth"
    },
    AUTH_KEY_ADDED: {
        HTTP_CODE: 200,
        RESPONSE_CODE: 17,
        INFO: "auth_key_added"
    },
    SPOT_STATUS_CHANGED: {
        HTTP_CODE: 200,
        RESPONSE_CODE: 19,
        INFO: "spot_status_changed"
    },
    MISSING_BODY: {
        HTTP_CODE: 422,
        RESPONSE_CODE: 20,
        INFO: "missing_body"
    },
    INVALID_STATUS_ENTERED: {
        HTTP_CODE: 422,
        RESPONSE_CODE: 21,
        INFO: "invalid_status_entered"
    },
    NEW_ACCESS_CODE: {
        HTTP_CODE: 200,
        RESPONSE_CODE: 22,
        INFO: "new_access_code"
    },
    PIN_EXPIRED: {
        HTTP_CODE: 403,
        RESPONSE_CODE: 23,
        INFO: "pin_expired"
    },
    INVALID_BLOCK_ID: {
        HTTP_CODE: 404,
        RESPONSE_CODE: 24,
        INFO: "invalid_block_id"
    },
    INVALID_BLOCK_ID_OR_SPOT_ID: {
        HTTP_CODE: 404,
        RESPONSE_CODE: 25,
        INFO: "invalid_block_id_or_spot_id"
    },
    INVALID_PERMISSION: {
        HTTP_CODE: 200,
        RESPONSE_CODE: 26,
        INFO: "invalid_permission"
    },
    ROUTE_CALCULATION_ERROR: {
        HTTP_CODE: 400,
        RESPONSE_CODE: 27,
        INFO: "route_calculation_error"
    },
    MAIN_ENDPOINT_FUNCTION_SUCCESS: {
        HTTP_CODE: 200,
        RESPONSE_CODE: 30,
        INFO: "main_endpoint_function_success"
    },
    ROUTING_ENDPOINT_FUNCTION_SUCCESS: {
        HTTP_CODE: 200,
        RESPONSE_CODE: 31,
        INFO: "routing_endpoint_function_success"
    },
    ADMIN_ENDPOINT_FUNCTION_SUCCESS: {
        HTTP_CODE: 200,
        RESPONSE_CODE: 32,
        INFO: "admin_endpoint_function_success"
    },
    AUTH_ENDPOINT_FUNCTION_SUCCESS: {
        HTTP_CODE: 200,
        RESPONSE_CODE: 33,
        INFO: "auth_endpoint_function_success"
    },
    PARKING_ENDPOINT_FUNCTION_SUCCESS: {
        HTTP_CODE: 200,
        RESPONSE_CODE: 34,
        INFO: "parking_endpoint_function_success"
    },
    USER_ENDPOINT_FUNCTION_SUCCESS: {
        HTTP_CODE: 200,
        RESPONSE_CODE: 35,
        INFO: "user_endpoint_function_success"
    },
    PROFILE_PIC_EXISTS: {
        HTTP_CODE: 200,
        RESPONSE_CODE: 36,
        INFO: "profile_pic_exists"
    },
    PROFILE_PIC_NULL: {
        HTTP_CODE: 200,
        RESPONSE_CODE: 37,
        INFO: "profile_pic_null"
    },
    PROFILE_PIC_UPDATED: {
        HTTP_CODE: 200,
        RESPONSE_CODE: 38,
        INFO: "profile_pic_updated"
    },
    INVALID_VEHICLE_ID: {
        HTTP_CODE: 200,
        RESPONSE_CODE: 39,
        INFO: "invalid_vehicle_id"
    },
    VALID_ACCESS_CODE: {
        HTTP_CODE: 200,
        RESPONSE_CODE: 40,
        INFO: "valid_access_code"
    },
    BIKES_ENDPOINT_FUNCTION_SUCCESS: {
        HTTP_CODE: 200,
        RESPONSE_CODE: 41,
        INFO: "bikes_endpoint_function_success"
    }
});