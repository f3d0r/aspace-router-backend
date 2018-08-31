var bcrypt = require('@auth-bcrypt');
const constants = require('@config');

module.exports = {
    authenticate: function (req, successCB, failCB) {
        var auth = req.get("authorization");
        if (!auth) {
            failCB('NO_AUTH');
        } else {
            var credentials = new Buffer(auth.split(" ").pop(), "base64").toString("ascii").split(":");
            if (credentials[0] == "" || credentials[1] == "") {
                failCB('INVALID_BASIC_AUTH');
            } else {
                bcrypt.authCheck(constants.mysql_config.ADMIN_TABLE, credentials[0], credentials[1],
                    function (username, permissions) {
                        successCB(username, permissions);
                    },
                    function () {
                        failCB('INVALID_BASIC_AUTH');
                    }
                );
            }
        }
    }
}