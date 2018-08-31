var sql = require('@sql');

module.exports = {
    accessAuth: function (accessCode, deviceId, successCB, failureCB) {
        sql.select.regularSelect('user_access_codes', null, ['access_code', 'device_id'], ['=', '='], [accessCode, deviceId], 1, function (user) {
            successCB(user)
        }, function () {
            failureCB();
        }, function (error) {
            failureCB();
        });
    }
}