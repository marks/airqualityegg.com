[![Build Status](https://travis-ci.org/marks/airqualityegg.com.png?branch=master)](https://travis-ci.org/xively/airqualityegg.com)

# Fork of AirQualityEgg.com

The Air Quality Egg dashboard is a [Ruby](http://www.ruby-lang.org/), 
[Sinatra](http://www.sinatrarb.com/) app that provides the web UI for the
[Air Quality Egg website](http://airqualityegg.com).

## Development

### Get the code
`git clone https://github.com/amcgail/louisvilleairmap.com.git && cd louisvilleairmap.com`
`git submodule init`
`git submodule update`

### Prerequisites

* A working Ruby environment. The app should work in all common flavours
  of ruby (1.8.7, 1.9.2, 1.9.3, Rubinius, jruby)

### Add environment variables to .env file

```bash
# Sample .env file
XIVELY_PRODUCT_ID:                # get this by logging into Xively.com and creating a product batch (Manage > Add Product Batch)
XIVELY_API_KEY:                   # get this by logging into Xively.com and creating a master key (Settings > Master Keys > Add Master Key
AIRNOW_USER:                      # get this from airnowapi.org - required for fetching EPA air quality data
AIRNOW_PASS:                      # same as AIRNOW_USER
AIRNOW_API_KEY:                   # API key from airnowapi.org
GOOGLE_ANALYTICS_TRACKING_ID:     # get from analytics.google.com or don't include and google analytics wont be used
GOOGLE_ANALYTICS_DOMAIN:          # same as GOOGLE_ANALYTICS_TRACKING_ID
HTTP_BASIC_USER:                  # username to protect some pages with
HTTP_BASIC_PASS:                  # password to protect some pages with
CKAN_HOST:                        # http://url-to-ckan.tld:port
CKAN_API_KEY:                     # CKAN API key for a user with the appropriate rights to data sets named below
CKAN_AQS_DATASET_ID:              # URL slug of your CKAN data set (created through CKAN web GUI) for AQS data
CKAN_AQS_SITE_RESOURCE_NAME:      AirNow AQS Monitoring Sites Loading
CKAN_AQS_DATA_RESOURCE_NAME:      AirNow AQS Monitoring Data Loading
CKAN_AQE_DATASET_ID:              # URL slug of your CKAN data set (created through CKAN web GUI) for AQE data
CKAN_AQE_SITE_RESOURCE_NAME:      Air Quality Egg Sites Loading
CKAN_AQE_DATA_RESOURCE_NAME:      Air Quality Egg Data Loading
CKAN_DATASET_KEYS:                AQS,AQE     # Needed so rb script can find CKAN* env vars
CKAN_DATASET_KEYS_SITES_JOINABLE: AQS,AQE  # Needed so rb script can find CKAN* env vars
WEATHER_UNDERGROUND_API_KEY:      # API key for Weather Underground
CONSTANTCONTACT_API_KEY:	  # Mashery API key
CONSTANTCONTACT_ACCESS_TOKEN:     # Access token granting access to CC account
CONSTANTCONTACT_LIST_ID:          # ID of contact list emails should go to
FOCUS_CITY:                       Louisville
FOCUS_CITY_NAME:                  Louisville, KY
FOCUS_CITY_LAT:                   38.22847167526397
FOCUS_CITY_LON:                   -85.76099395751953
FOCUS_CITY_ZOOM:                  10
FOCUS_CITY_STATE:                 KY
```

The values in this file are required to interact with Xively, but some value
for each environment variable is required to boot the app locally, so initially
just create the file with dummy contents. Note that this means your local app 
won't be able to actually interact with Xively, but you will be able to view the 
AQE site running locally.

### Install bundler gem

`gem install bundler`

### Install all gem dependencies

`bundle install`

### Start webserver

`bundle exec foreman start`

Visit http://localhost:4567, and you should see a version of the AQE 
website running locally on your machine.

### Running the tests

`bundle exec rake`

### Importing constantly updating datasets data to CKAN
```bash
foreman run bundle exec rake ckan:airnow:update # takes about 45 minutes
foreman run bundle exec rake ckan:airqualityeggs:update # takes about 10 minutes for 1,000 eggs
foreman run bundle exec rake ckan:airqualityeggs:update # takes about 10 seconds for 5 sites
```

### To upload local database to Heroku
```bash
heroku pg:reset DATABASE_URL
heroku pg:push postgres://localhost/airquality DATABASE_URL
```
Be sure to restart heroku after this as the database socket connection will need to be re-initialized

#### Sample crontab entries (assumes GMT time)
```bash
# run airnow on even hours and airqualityeggs updates on odd hours
30   */2     *   *  * ec2-user        source /home/ec2-user/.rvm/environments/ruby-2.0.0-p451 && cd /home/ec2-user/airqualityegg.com && foreman run bundle exec rake ckan:airnow:update
30    1-23/2    * * * ec2-user        source /home/ec2-user/.rvm/environments/ruby-2.0.0-p451 && cd /home/ec2-user/airqualityegg.com && foreman run bundle exec rake ckan:airqualityeggs:update

# family allergy and asthma data 
15   1  *	* * ec2-user        source /home/ec2-user/.rvm/environments/ruby-2.0.0-p451 && cd /home/ec2-user/airqualityegg.com && foreman run bundle exec rake ckan:famallergy:update 

# weather underground weather station scraping
45   3  *	* * ec2-user        source /home/ec2-user/.rvm/environments/ruby-2.0.0-p451 && cd /home/ec2-user/airqualityegg.com && foreman run bundle exec rake ckan:wupws:update 

# send daily email to subscribers at 6am each day
0   10  *	* * ec2-user        source /home/ec2-user/.rvm/environments/ruby-2.0.0-p451 && cd /home/ec2-user/airqualityegg.com && foreman run bundle exec rake mailer:institute_messages:daily
# check for notifcation-worthy observations
0   *  *	* * ec2-user        source /home/ec2-user/.rvm/environments/ruby-2.0.0-p451 && cd /home/ec2-user/airqualityegg.com && foreman run bundle exec rake mailer:institute_messages:breaking



```

## Sample CKAN (Datastore) SQL

### Join AQE sensor readings (from data_table) with their lat/lon values (from sites_table)
```sql
SELECT
  data_table.feed_id,data_table.datetime,data_table.parameter,data_table.value,data_table.unit,
  sites_table.location_lat, sites_table.location_lon
FROM
  "c0d9ab3c-91a3-4fe8-8f54-5d3009e4f01d" sites_table
INNER JOIN "d8482637-477b-4e45-a7f5-6b2ceb98c7e5" data_table ON sites_table.id = data_table.feed_id
LIMIT 10000
```

## Backing up

Virtual machine/AWS EC2 full image backups are always a good idea in addition to the following:

### CKAN
`paster --plugin=ckan db dump 06292014-ckan_full_dump.sql --config=/etc/ckan/default/development.ini`
`paster --plugin=ckan db simple-dump-json 06292014-ckan.json --config=/etc/ckan/default/development.ini`
`paster --plugin=ckan db simple-dump-csv 06292014-ckan.csv --config=/etc/ckan/default/development.ini`

### CKAN Datastore
`pg_dump datastore_default -U ckan_default -W > 06292014-ckan_datastore_dump.sql -h localhost`

## Contributing

Please see our [Contributing guidelines](https://github.com/xively/airqualityegg.com/blob/master/CONTRIBUTING.md).

## License

Please see [LICENSE](https://github.com/xively/airqualityegg.com/blog/master/LICENSE) for licensing details.

## Support

Please file any issues at our [Github issues page](https://github.com/xively/airqualityegg.com/issues).
For general disussion about the project please go to the [Air Quality Egg group](https://groups.google.com/forum/#!forum/airqualityegg).

[![githalytics.com alpha](https://cruel-carlota.pagodabox.com/66c4028a64953ab110a8fd2ea42ca216 "githalytics.com")](http://githalytics.com/xively/airqualityegg.com)
