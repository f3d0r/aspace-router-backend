var aws = require('aws-sdk');

const spacesEndpoint = new aws.Endpoint('nyc3.digitaloceanspaces.com');
const accessKey = '***REMOVED***';
const secretKey = '***REMOVED***';

module.exports = {
    express: {
        RESPONSE_TIMEOUT_MILLI: 10000
    },
    twilio: {
        TWILIO_ACCOUNT_SID: 'twilio_sid',
        TWILIO_AUTH_TOKEN: 'twilio_auth_token',
        ORIGIN_PHONE: 'twilio_origin_phone_number'
    },
    mysql_config: {
        ADMIN_TABLE: 'aspace_admins'
    },
    auth: {
        PIN_EXPIRY_MINUTES: 5,
        INTERNAL_AUTH_KEY: '***REMOVED***'
    },
    bcrypt: {
        SALT_ROUNDS: 10
    },
    sensors: {
        sensorDeltaFeet: 2
    },
    slack: {
        webhook: '***REMOVED***'
    },
    db: {
        DATABASE_USER: 'api',
        DATABASE_PASSWORD: 'db_password',
        DATABASE_NAME: 'aspace',
        DATABASE_IP: '159.89.131.95',
        DATABASE_PORT: 'db_port'
    },
    digitalocean: {
        BUCKET_NAME: 'aspace',
        S3: new aws.S3({
            endpoint: spacesEndpoint,
            accessKeyId: accessKey,
            secretAccessKey: secretKey
        }),
        BUCKET_BASE_URL: 's3_bucket_url',
        PROFILE_PIC_ENDPOINT: '***REMOVED***',
        PROFILE_PIC_EXTENSION: '.png'
    },
    fs_paths: {
        profile_pics: 'uploads/profile_pic_temp/'
    },
    geojson: {
        settings: {
            Point: ['lat', 'lng']
        }
    },
    mapbox: {
        API_KEY: '***REMOVED***'
    },
    optimize: {
        DRIVE_PARK: '***REMOVED***',
        PARK_BIKE: '***REMOVED***',
        PARK_WALK: '***REMOVED***',
        time_threshold: 600,
        cluster_distance_threshold: 0.1
    }
}