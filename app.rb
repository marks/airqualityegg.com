require 'rubygems'
require 'bundler/setup'
require 'sinatra/base'
require 'sinatra/reloader' if Sinatra::Base.development?
require 'sass'
require 'xively-rb'
require 'dalli'
require 'memcachier'
require 'json'
require 'oboe-heroku'
require 'rest-client'
require 'json'

require './lib/helpers'
include AppHelpers
require './lib/models'


ENV["aqs_site_resource"] = get_ckan_resource_by_name(ENV['CKAN_AQS_SITE_RESOURCE_NAME'])["id"]
ENV["aqe_site_resource"] = get_ckan_resource_by_name(ENV['CKAN_AQE_SITE_RESOURCE_NAME'])["id"]

class AirQualityEgg < Sinatra::Base

  configure do
    enable :sessions
    enable :logging
    $product_id = ENV['XIVELY_PRODUCT_ID']
    $api_key = ENV['XIVELY_API_KEY']
    $api_url = ENV['XIVELY_API_URL'] || Xively::Client.base_uri

    raise "PRODUCT_ID not set" if $product_id.nil?
    raise "API_KEY not set" if $api_key.nil?
    raise "API_URL not set" if $api_url.nil?
    puts "WARN: You should set a SESSION_SECRET" unless ENV['SESSION_SECRET']

    set :session_secret, ENV['SESSION_SECRET'] || 'airqualityegg_session_secret'
    set :cache, Dalli::Client.new
    set :time_zone, ActiveSupport::TimeZone.new("Eastern Time (US & Canada)")
  end

  configure :production do
    require 'newrelic_rpm'
    set :cache_time, 3600*12 # 12 hours
  end

  configure :development do
    $stdout.sync = true
    set :logging, Logger::DEBUG
    register Sinatra::Reloader
    also_reload "lib/*.rb"
    set :cache_time, 3600*12 # five minutes
  end

  helpers do
    def protected!
      return if authorized?
      headers['WWW-Authenticate'] = 'Basic realm="Temporarily Restricted Area"'
      halt 401, "Sorry, Not authorized\n"
    end

    def authorized?
      if ENV["HTTP_BASIC_USER"] && ENV["HTTP_BASIC_PASS"]
        @auth ||=  Rack::Auth::Basic::Request.new(request.env)
        @auth.provided? and @auth.basic? and @auth.credentials and @auth.credentials == [ENV["HTTP_BASIC_USER"], ENV["HTTP_BASIC_PASS"]]
      else
        true
      end
    end
  end


  # Render css from scss
  get '/style.css' do
    scss :style
  end

  # Home page
  get '/' do
    @local_feed_path = '/all_eggs.json'
    @error = session.delete(:error)
    erb :home
  end

  get '/derby' do
    protected!
    @local_feed_path = '/all_eggs.json'
    @error = session.delete(:error)
    @custom_js = 'derby'
    erb :home
  end

  get '/all_eggs.json' do
    content_type :json
    cache_key = "all_eggs"
    cached_data = settings.cache.fetch(cache_key) do

      all_aqe_sql = "SELECT id,created,description,feed,location_domain,location_ele,location_exposure,location_lat,location_lon,status,title from \"#{ENV["aqe_site_resource"]}\""
      all_aqe_sites = sql_search_ckan(all_aqe_sql)

      # store in cache and return
      settings.cache.set(cache_key, all_aqe_sites, settings.cache_time)
      all_aqe_sites
    end
    return cached_data.to_json
  end

  get '/all_aqs_sites.json' do
    content_type :json
    cache_key = "all_aqs_sites"
    cached_data = settings.cache.fetch(cache_key) do
      all_aqs_sql = "SELECT aqs_id,site_name,agency_name,elevation,msa_name,cmsa_name,county_name,status,lat,lon from \"#{ENV["aqs_site_resource"]}\" WHERE status = 'Active'"
      all_aqs_sites = sql_search_ckan(all_aqs_sql)
      settings.cache.set(cache_key, all_aqs_sites, settings.cache_time)
      all_aqs_sites
    end
    return cached_data.to_json
  end

  get '/recently_:order.json' do
    content_type :json
    cache_key = "recently_#{params[:order]}"
    cached_data = settings.cache.fetch(cache_key) do
      # fetch feeds based on input
      recently_response = fetch_xively_url("#{$api_url}/v2/feeds.json?user=airqualityegg&mapped=true&content=summary&per_page=10&order=#{params[:order]}")
      recently_results = Xively::SearchResult.new(recently_response.body).results.map(&:attributes)
      # store in cache and return
      settings.cache.set(cache_key, recently_results, settings.cache_time)
      recently_results
    end
    return cached_data.to_json
  end


  get '/aqs/:aqs_id.json' do
    content_type :json
    site = EpaSite.find_by(:aqs_id => params[:aqs_id])
    data = site.attributes
    data[:latest_hourly] = site.latest_hourly_data.map(&:attributes)
    data[:latest_daily] = site.latest_daily_data.map(&:attributes)
    if params[:include_recent_history]
      series = []
      recent_history = site.epa_datas.recent
      series_names = recent_history.map(&:parameter).uniq
      series_names.each do |series_name|
        series_datapoints = recent_history.select{|x| x.parameter == series_name}
        series << {
          :data => series_datapoints.map {|x| [x.date.to_time.utc.change(:hour => x.hour, :zone_offset => '0').to_i*1000,x.value.to_f] },
          :name => "#{series_name} (#{series_datapoints.first.unit})" # assumption: all are the same for a given parameter
        }
      end
      data[:recent_history] = series
    end
    return data.to_json
  end

  get '/aqs/:aqs_id' do
    @site = EpaSite.find_by(:aqs_id => params[:aqs_id])
    @latest_hourly_data = @site.latest_hourly_data
    @latest_daily_data = @site.latest_daily_data
    @local_feed_path = "/eggs/nearby/#{@site.lat}/#{@site.lon}.json"
    erb :show_aqs
  end


  # Edit egg metadata
  # get '/egg/:id/edit' do
  #   feed_id, api_key = extract_feed_id_and_api_key_from_session
  #   redirect_with_error('Not your egg') if feed_id.to_s != params[:id]
  #   response = Xively::Client.get(feed_url(feed_id), :headers => {'Content-Type' => 'application/json', "X-ApiKey" => api_key})
  #   @feed = Xively::Feed.new(response.body)
  #   erb :edit
  # end

  # Register your egg
  # post '/register' do
  #   begin
  #     logger.info("GET: #{product_url}")
  #     response = Xively::Client.get(product_url, :headers => {'Content-Type' => 'application/json', "X-ApiKey" => $api_key})
  #     json = MultiJson.load(response.body)
  #     session['response_json'] = json
  #     feed_id, api_key = extract_feed_id_and_api_key_from_session
  #     redirect_with_error("Egg not found") unless feed_id
  #     redirect "/egg/#{feed_id}/edit"
  #   rescue
  #     redirect_with_error "Egg not found"
  #   end
  # end

  # Update egg metadata
  # post '/egg/:id/update' do
  #   feed_id, api_key = extract_feed_id_and_api_key_from_session
  #   redirect_with_error('Not your egg') if feed_id.to_s != params[:id]
  #   new_tags = [params[:existing_tags], "device:type=airqualityegg"].compact.delete_if {|tag| tag.empty?}
  #   feed = Xively::Feed.new({
  #     :title => params[:title],
  #     :description => params[:description],
  #     :id => feed_id,
  #     :private => false,
  #     :location_ele => params[:location_ele],
  #     :location_lat => params[:location_lat],
  #     :location_lon => params[:location_lon],
  #     :location_exposure => params[:location_exposure],
  #     :tags => new_tags.join(',')
  #   })
  #   response = Xively::Client.put(feed_url(feed_id), :headers => {'Content-Type' => 'application/json', "X-ApiKey" => api_key}, :body => feed.to_json)
  #   redirect "/egg/#{feed_id}"
  # end

  get '/egg/:id.json' do
    content_type :json
    response = Xively::Client.get(feed_url(params[:id]), :headers => {"X-ApiKey" => $api_key})
    feed = Xively::Feed.new(response.body)
    datastreams = feed.datastreams
    data = feed.attributes
    data[:datastreams] = {}
    data[:datastreams][:NO2] = datastreams.detect{|d| !d.tags.nil? && d.tags.match(/computed/) && d.tags.match(/sensor_type=NO2/)}
    data[:datastreams][:CO] = datastreams.detect{|d| !d.tags.nil? && d.tags.match(/computed/) && d.tags.match(/sensor_type=CO/)}
    data[:datastreams][:Dust] = datastreams.detect{|d| !d.tags.nil? && d.tags.match(/computed/) && d.tags.match(/sensor_type=Dust/)}
    data[:datastreams][:Temperature] = datastreams.detect{|d| !d.tags.nil? && d.tags.match(/computed/) && d.tags.match(/sensor_type=Temperature/)}
    data[:datastreams][:Humidity] = datastreams.detect{|d| !d.tags.nil? && d.tags.match(/computed/) && d.tags.match(/sensor_type=Humidity/)}
    if data[:datastreams][:Temperature] && data[:datastreams][:Temperature].unit_symbol == "deg C"
      data[:datastreams][:Temperature].unit_symbol = "°F"
      data[:datastreams][:Temperature].unit_label = "°F"
      data[:datastreams][:Temperature].current_value = celsius_to_fahrenheit(data[:datastreams][:Temperature].current_value.to_f)
      data[:datastreams][:Temperature].max_value = celsius_to_fahrenheit(data[:datastreams][:Temperature].max_value.to_f)
      data[:datastreams][:Temperature].min_value = celsius_to_fahrenheit(data[:datastreams][:Temperature].min_value.to_f)
    end
    data[:datastreams].each do |metric, hash|
      if hash
        data[:datastreams][metric] = hash.attributes
        data[:datastreams][metric][:aqi_range] = determine_aqi_range(metric.to_s,hash.current_value.to_f,hash.unit_label)
      end
    end
    data.to_json
  end

  # View egg dashboard
  get '/egg/:id' do
    response = Xively::Client.get(feed_url(params[:id]), :headers => {"X-ApiKey" => $api_key})
    @datastreams = []
    @feed = Xively::Feed.new(response.body)
    @no2 = @feed.datastreams.detect{|d| !d.tags.nil? && d.tags.match(/computed/) && d.tags.match(/sensor_type=NO2/)}
    if @no2 && @no2.current_value == "-2147483648"
      remove_instance_variable(:@no2)      # weird AQE bug
    end
    @co = @feed.datastreams.detect{|d| !d.tags.nil? && d.tags.match(/computed/) && d.tags.match(/sensor_type=CO/)}
    @dust = @feed.datastreams.detect{|d| !d.tags.nil? && d.tags.match(/computed/) && d.tags.match(/sensor_type=Dust/)}
    @temperature = @feed.datastreams.detect{|d| !d.tags.nil? && d.tags.match(/computed/) && d.tags.match(/sensor_type=Temperature/)}
    @humidity = @feed.datastreams.detect{|d| !d.tags.nil? && d.tags.match(/computed/) && d.tags.match(/sensor_type=Humidity/)}
    @local_feed_path = "/eggs/nearby/#{@feed.location_lat}/#{@feed.location_lon}.json"
    [@no2, @co, @temperature, @humidity, @dust].each{|x| @datastreams << x.id if x}
    erb :show
  end

  get '/eggs/nearby/:lat/:lon.json' do
    content_type :json
    @feeds = find_egg_feeds_near(@feed, params[:lat], params[:lon])
    @feeds = @feeds.first(params[:limit].to_i) if params[:limit].to_i != 0
    @map_markers = collect_map_markers(@feeds)
    return @map_markers
  end

  get '/cache/flush' do
    return settings.cache.flush.to_s
  end

  private

  def extract_feed_id_and_api_key_from_session
    [session['response_json']['feed_id'], session['response_json']['apikey']]
  rescue
    redirect_with_error('Egg not found')
  end

  def find_egg_feeds_near(feed, lat=nil, lon=nil)
    find_egg_feeds(feed, lat, lon)
  end

  def find_egg_feeds(feed = nil, lat = nil, lon = nil)
    url = feeds_url(feed, lat, lon)
    logger.info("GET: #{url} - geosearch")
    response = Xively::Client.get(url, :headers => {'Content-Type' => 'application/json', 'X-ApiKey' => $api_key})
    @feeds = Xively::SearchResult.new(response.body).results
  rescue
    @feeds = Xively::SearchResult.new().results
  end

  def feed_url(feed_id)
    "#{$api_url}/v2/feeds/#{feed_id}.json"
  end

  def feeds_url(feed, lat, lon)
    if feed && feed.location_lat && feed.location_lon
      feeds_near = "&lat=#{feed.location_lat}&lon=#{feed.location_lon}&distance=500&distance_units=kms"
    elsif lat and lon
      feeds_near = "&lat=#{lat}&lon=#{lon}&distance=500&distance_units=kms"
    else
      feeds_near = ''
    end
    "#{$api_url}/v2/feeds.json?user=airqualityegg&mapped=true#{feeds_near}"
  end


  def product_url
    redirect_with_error('Please enter a serial number') if params[:serial].blank?
    "#{$api_url}/v2/products/#{$product_id}/devices/#{params[:serial].downcase}/activate"
  end

  def redirect_with_error(message)
    session['error'] = message
    redirect '/'
  end
end
