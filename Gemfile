source 'https://rubygems.org'

ruby '2.0.0'

gem 'sinatra'
gem 'xively-rb'
gem 'sass'
gem 'newrelic_rpm'
gem 'thin'
gem 'rack-force_domain'

gem 'memcachier'
gem 'dalli'

gem "pg"
gem "activerecord"
gem "sinatra-activerecord"
gem 'rake'

group :development do
  gem 'foreman'
end

gem 'rspec'
gem 'rack-test'

group :development, :test do
  gem 'sinatra-contrib'
  gem 'capybara'
  gem 'webmock'
end

group :production do
  require 'oboe-heroku' # for TraceView
end