[![Build Status](https://travis-ci.org/marks/airqualityegg.com.png?branch=master)](https://travis-ci.org/xively/airqualityegg.com)

# Fork of AirQualityEgg.com

The Air Quality Egg dashboard is a [Ruby](http://www.ruby-lang.org/), 
[Sinatra](http://www.sinatrarb.com/) app that provides the web UI for the
[Air Quality Egg website](http://airqualityegg.com).

## Development

### Prerequisites

* A working Ruby environment. The app should work in all common flavours
  of ruby (1.8.7, 1.9.2, 1.9.3, Rubinius, jruby)

### Add environment variables to .env file

```bash
# Sample .env file
XIVELY_PRODUCT_ID:            # get this by logging into Xively.com and creating a product batch (Manage > Add Product Batch)
XIVELY_API_KEY:               # get this by logging into Xively.com and creating a master key (Settings > Master Keys > Add Master Key
AIRNOW_USER:                  # get this from airnowapi.org - required for fetching EPA air quality data
AIRNOW_PASS:                  # same as AIRNOW_USER
GOOGLE_ANALYTICS_TRACKING_ID: # get from analytics.google.com or don't include and google analytics wont be used
GOOGLE_ANALYTICS_DOMAIN:      # same as GOOGLE_ANALYTICS_TRACKING_ID
HTTP_BASIC_USER:              # username to protect some pages with
HTTP_BASIC_PASS:              # password to protect some pages with
CKAN_HOST:                    # http://url-to-ckan.tld:port
CKAN_API_KEY:                 # CKAN API key for a user with the appropriate rights to data sets named below
CKAN_AQS_DATASET_ID:          # URL slug of your CKAN data set (created through CKAN web GUI) for AQS data
CKAN_AQS_SITE_RESOURCE_NAME:  AirNow AQS Monitoring Sites
CKAN_AQS_DATA_RESOURCE_NAME:  AirNow AQS Monitoring Data
CKAN_AQE_DATASET_ID:          # URL slug of your CKAN data set (created through CKAN web GUI) for AQE data
CKAN_AQE_SITE_RESOURCE_NAME:  Air Quality Egg Sites
CKAN_AQE_DATA_RESOURCE_NAME:  Air Quality Egg Data

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

### Importing AirNow monitoring sites and daily data into app database
`foreman run bundle exec rake db:migrate` 
`foreman run bundle exec rake airnow:sites:import` - Using Heroku Scheduler, we run this once a day
`foreman run bundle exec rake airnow:daily_data:import` - Using Heroku Scheduler, we run this once an hour

### Importing AirNow and AirQualityEgg sites and sensor data to CKAN
`foreman run bundle exec rake ckan:airnow:update` # takes about 45 minutes
`foreman run bundle exec rake ckan:airqualityeggs:update` # takes about 10 minutes for 1,000 eggs

### To upload local database to Heroku

`heroku pg:reset DATABASE_URL`
`heroku pg:push postgres://localhost/airquality DATABASE_URL`

Be sure to restart heroku after this as the database socket connection will need to be re-initialized

#### Sample crontab entries
```bash
# run airnow on even hours and airqualityeggs updates on odd hours
30   */2     *   *  * ec2-user        source /home/ec2-user/.rvm/environments/ruby-2.0.0-p451 && cd /home/ec2-user/airqualityegg.com && foreman run bundle exec rake ckan:airnow:update
30    1-23/2    * * * ec2-user        source /home/ec2-user/.rvm/environments/ruby-2.0.0-p451 && cd /home/ec2-user/airqualityegg.com && foreman run bundle exec rake ckan:airqualityeggs:update
```

## Contributing

Please see our [Contributing guidelines](https://github.com/xively/airqualityegg.com/blob/master/CONTRIBUTING.md).

## License

Please see [LICENSE](https://github.com/xively/airqualityegg.com/blog/master/LICENSE) for licensing details.

## Support

Please file any issues at our [Github issues page](https://github.com/xively/airqualityegg.com/issues).
For general disussion about the project please go to the [Air Quality Egg group](https://groups.google.com/forum/#!forum/airqualityegg).

[![githalytics.com alpha](https://cruel-carlota.pagodabox.com/66c4028a64953ab110a8fd2ea42ca216 "githalytics.com")](http://githalytics.com/xively/airqualityegg.com)
