[![Build Status](https://travis-ci.org/xively/airqualityegg.com.png?branch=master)](https://travis-ci.org/xively/airqualityegg.com)

# Airqualityegg.com

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
PRODUCT_ID=xxxxxx # get this by logging into Xively.com and creating a product batch (Manage > Add Product Batch)
API_KEY=xxxxxxx # get this by logging into Xively.com and creating a master key (Settings > Master Keys > Add Master Key
AIRNOW_USER=xxxxxx # get this from airnowapi.org - required for fetching EPA air quality data
AIRNOW_PASS=xxxxxx # same as AIRNOW_USER
GOOGLE_ANALYTICS_TRACKING_ID=xxxxxx # get from analytics.google.com or don't include and google analytics wont be used
GOOGLE_ANALYTICS_DOMAIN=xxxxxx # same as GOOGLE_ANALYTICS_TRACKING_ID
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

Visit http://localhost:5000, and you should see a version of the AQE 
website running locally on your machine.

### Running the tests

`bundle exec rake`

### Importing AirNow monitoring sites and daily data
`foreman run bundle exec rake db:migrate

`foreman run bundle exec rake airnow:sites:download_from_ftp`
`foreman run bundle exec rake airnow:sites:import_into_db`

`foreman run bundle exec rake airnow:daily_data:download_from_ftp`
`foreman run bundle exec rake airnow:daily_data:import_into_db`

### To upload local database to Heroku

This must be done because Heroku does not have a writeable filesystem which is required for downloading the FTP files from AirNow

`heroku pg:reset DATABASE_URL`
`heroku pg:push postgres://localhost/airquality DATABASE_URL`
\
Be sure to restart heroku after this as the database socket connection will need to be re-initialized

## Contributing

Please see our [Contributing guidelines](https://github.com/xively/airqualityegg.com/blob/master/CONTRIBUTING.md).

## License

Please see [LICENSE](https://github.com/xively/airqualityegg.com/blog/master/LICENSE) for licensing details.

## Support

Please file any issues at our [Github issues page](https://github.com/xively/airqualityegg.com/issues).
For general disussion about the project please go to the [Air Quality Egg group](https://groups.google.com/forum/#!forum/airqualityegg).

[![githalytics.com alpha](https://cruel-carlota.pagodabox.com/66c4028a64953ab110a8fd2ea42ca216 "githalytics.com")](http://githalytics.com/xively/airqualityegg.com)
