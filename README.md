# meraki-socket-indoor-location-emitter

Node.js server to provide IndoorLocation from Cisco Meraki. Works with socketIndoorLocationProviders libraries on iOS, Android and JS.


## Installation

Node.js is required.

*   Clone the repository
*   Go to this folder, and install the modules
    ```
    npm i
    ```


## meraki-listener

NodeJS server to react on Meraki notifications.
Each notification will be received and processed into an indorLocation object.

The computed indoorLocation will be saved in a redis database with the IP address as userId to be used by the emitter.

Thanks to redis, we will be notified each time a key value has been changed.

To do so, redis notifications have to be enabled with the command described below.
```
redis-cli config set notify-keyspace-events K$
```

### Use

*   We first need to correctly set the configuration parameters
    *   Directly in the `config/all.js` file
    *   Via environment variables
        *   PORT: port used by the server
        *   SECRET: secret defined in the Meraki dashboard to authenticate the POST query (__required__)
        *   VALIDATOR: token defined by Meraki to identify the source (__required__)
        *   FLOOR_PLANS: serialized Meraki JSON floor plans (_required_)
        *   REDIS_HOST: redis host (__required__)
        *   REDIS_PORT: redis port
        *   REDIS_AUTH: redis password (__required__ if set)
        *   REDIS_MERAKI_NOTIF_TTL: redis key TTL
*   Start the server
    ```
    npm run start-listener
    ```

#### Notes

To correctly serialize the Meraki configuration, one can execute the command described below:
```
export FLOOR_PLANS=$(node -e 'var json = require("FILEPATH"); console.log(JSON.stringify(json));')
```

If you want to put this variable into your clipboard instead, please execute the command below:
```
node -e 'var json = require("FILEPATH"); console.log(JSON.stringify(json));' | pbcopy
```

An example of a valid JSON Meraki floor plans configuration can be found at `meraki-listener/test/floor-plans.json`.


## meraki-emitter

NodeJS server to react on socket indoor location providers.
Each socket connection will lead to a redis subscription that will help to only get the indoorLocation objects when the location of a user has been changed.
These objects will be sent to the providers via a socket channel.

### Use

*   We first need to correctly set the configuration parameters
    *   Directly in the `config/all.js` file
    *   Via environment variables
        *   PORT: port used by the server
        *   REDIS_HOST: redis host (__required__)
        *   REDIS_PORT: redis port
        *   REDIS_AUTH: redis password (__required__ if set)
*   Start the server
    ```
    npm run start-emitter
    ```
