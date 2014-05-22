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
require 'net/ftp'

require './lib/helpers'
include AppHelpers
require "sinatra/activerecord"
ActiveRecord::Base.logger = Logger.new(STDOUT)

# TODO - clean up
ENV["aqs_site_resource"] = get_ckan_resource_by_name(ENV['CKAN_AQS_SITE_RESOURCE_NAME'])["id"]
ENV["aqs_data_resource"] = get_ckan_resource_by_name(ENV['CKAN_AQS_DATA_RESOURCE_NAME'])["id"]
ENV["aqe_site_resource"] = get_ckan_resource_by_name(ENV['CKAN_AQE_SITE_RESOURCE_NAME'])["id"]
ENV["aqe_data_resource"] = get_ckan_resource_by_name(ENV['CKAN_AQE_DATA_RESOURCE_NAME'])["id"]

class AirQualityEgg < Sinatra::Base

  configure do
    enable :sessions
    enable :logging

    $product_id = ENV['XIVELY_PRODUCT_ID']
    $api_key = ENV['XIVELY_API_KEY']
    $api_url = ENV['XIVELY_API_URL'] || Xively::Client.base_uri

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

  get '/boston' do
    redirect '/#12/42.3593/-71.1315'
  end


  get '/all_eggs.json' do
    content_type :json
    cache_key = "all_eggs"
    cached_data = settings.cache.fetch(cache_key) do
      all_aqe_sql = "SELECT id,created,description,feed,location_domain,location_ele,location_exposure,location_lat,location_lon,status,title,updated from \"#{ENV["aqe_site_resource"]}\""
      all_aqe_sites = sql_search_ckan(all_aqe_sql)
      all_aqe_sites = all_aqe_sites.to_json
      # store in cache and return
      settings.cache.set(cache_key, all_aqe_sites, settings.cache_time)
      all_aqe_sites
    end
    return cached_data
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

  get '/aqs/:aqs_id.json' do
    content_type :json

    site_sql = "SELECT aqs_id,site_name,agency_name,elevation,msa_name,cmsa_name,county_name,status,lat,lon,gmt_offset from \"#{ENV["aqs_site_resource"]}\" WHERE aqs_id = '#{params[:aqs_id]}'"
    data = sql_search_ckan(site_sql).first

    data[:datastreams] = {}
    datastreams_sql = <<-EOS
      SELECT
        data_table.aqs_id,data_table.date, data_table.time,data_table.parameter,data_table.value,data_table.unit,data_table.computed_aqi
      FROM
        "#{ENV["aqs_site_resource"]}" sites_table
      INNER JOIN "#{ENV["aqs_data_resource"]}" data_table ON sites_table.aqs_id = data_table.aqs_id
      WHERE sites_table.aqs_id = '#{params[:aqs_id]}'
      order by date desc, time desc
      LIMIT (
        SELECT COUNT(DISTINCT(data_table.parameter))
        FROM "#{ENV["aqs_data_resource"]}" data_table
        WHERE data_table.aqs_id = '#{params[:aqs_id]}'
      )
    EOS
    datastreams_data = sql_search_ckan(datastreams_sql)
    datastreams_data.each do |datastream|
      data[:datastreams][datastream["parameter"].to_sym] = datastream if datastream
    end    

    datastreams_aqi_asc = data[:datastreams].sort_by{|key,hash| hash["computed_aqi"].to_i}.last
    data[:prevailing_aqi] = datastreams_aqi_asc.last if datastreams_aqi_asc && !datastreams_aqi_asc.last["computed_aqi"].nil?

    if params[:include_recent_history]
      series = []
      recent_history_sql = "SELECT * from \"#{ENV["aqs_data_resource"]}\" WHERE aqs_id = '#{params[:aqs_id]}' and date > current_date - 45 order by date, time "
      recent_history = sql_search_ckan(recent_history_sql)
      series_names = recent_history.map{|x| x["parameter"]}.uniq
      series_names.each do |series_name|
        series_datapoints = recent_history.select{|x| x["parameter"] == series_name}
        series << {
          :data => series_datapoints.map {|x| [x["date"].to_time.utc.change(:hour => x["time"], :zone_offset => '0').to_i*1000,x["value"].to_f] },
          :name => "#{series_name} (#{series_datapoints.first["unit"]})" # assumption: all are the same for a given parameter
        }
      end
      data[:recent_history] = series
    end
    return data.to_json
  end

  get '/aqs/:aqs_id' do
    site_sql = "SELECT * from \"#{ENV["aqs_site_resource"]}\" WHERE aqs_id = '#{params[:aqs_id]}'"
    @site = sql_search_ckan(site_sql).first

    @datastreams = {}
    datastreams_sql = <<-EOS
      SELECT
        data_table.aqs_id,data_table.date, data_table.time,data_table.parameter,data_table.value,data_table.unit,data_table.computed_aqi
      FROM
        "#{ENV["aqs_site_resource"]}" sites_table
      INNER JOIN "#{ENV["aqs_data_resource"]}" data_table ON sites_table.aqs_id = data_table.aqs_id
      WHERE sites_table.aqs_id = '#{params[:aqs_id]}'
      order by date desc, time desc
      LIMIT (
        SELECT COUNT(DISTINCT(data_table.parameter))
        FROM "#{ENV["aqs_data_resource"]}" data_table
        WHERE data_table.aqs_id = '#{params[:aqs_id]}'
      )
    EOS
    datastreams_data = sql_search_ckan(datastreams_sql)
    datastreams_data.each do |datastream|
      @datastreams[datastream["parameter"].to_sym] = datastream if datastream
    end    

    datastreams_aqi_asc = @datastreams.sort_by{|key,hash| hash["computed_aqi"].to_i}.last
    @prevailing_aqi_component = datastreams_aqi_asc.last if datastreams_aqi_asc && !datastreams_aqi_asc.last["computed_aqi"].nil?


    # daily_sql = "SELECT T.id,T.date,T.parameter,T.unit,T.value,T.computed_aqi,T.data_source FROM \"#{ENV["aqs_data_resource"]}\" T INNER JOIN (SELECT \"#{ENV["aqs_data_resource"]}\".parameter, MAX (DATE) AS MaxDate FROM \"#{ENV["aqs_data_resource"]}\" GROUP BY parameter) tm ON T.parameter = tm.parameter AND T.date = tm.MaxDate and T.aqs_id = '#{params['aqs_id']}' and T.time is NULL"
    # @latest_daily_data = sql_search_ckan(daily_sql)

    # hourly_sql = "SELECT T.id,tm.MaxTimestamp AS date,T.parameter,T.unit,T.computed_aqi,T.value,T.data_source FROM \"#{ENV["aqs_data_resource"]}\" T INNER JOIN (SELECT \"#{ENV["aqs_data_resource"]}\". PARAMETER,  MAX((\"#{ENV["aqs_data_resource"]}\".date||' '||\"#{ENV["aqs_data_resource"]}\".time)::timestamp) as MaxTimestamp FROM \"#{ENV["aqs_data_resource"]}\" GROUP BY PARAMETER) tm ON T . PARAMETER = tm. PARAMETER AND (T.date||' '||T.time)::timestamp = tm.MaxTimestamp AND T .aqs_id = '#{params['aqs_id']}'"
    # @latest_hourly_data = sql_search_ckan(hourly_sql)

    # datastreams_aqi_asc = (@latest_hourly_data + @latest_daily_data).sort_by{|hash| hash["computed_aqi"].to_i }
    # @prevailing_aqi_component =datastreams_aqi_asc.last if datastreams_aqi_asc && !datastreams_aqi_asc.last["computed_aqi"].nil?

    @local_feed_path = "/eggs/nearby/#{@site["lat"]}/#{@site["lon"]}.json"
    erb :show_aqs
  end

  get '/egg/:id.json' do
    content_type :json

    egg_sql = "SELECT feed,status,updated,location_domain,description,location_lon,location_lat,created,location_exposure,location_ele,title from \"#{ENV["aqe_site_resource"]}\" WHERE id = '#{params[:id]}'"
    data = sql_search_ckan(egg_sql).first

    data[:datastreams] = {}
    datastreams_sql = <<-EOS
      SELECT
        data_table.feed_id,data_table.datetime,data_table.parameter,data_table.value,data_table.unit,data_table.computed_aqi
      FROM
        "#{ENV["aqe_site_resource"]}" sites_table
      INNER JOIN "#{ENV["aqe_data_resource"]}" data_table ON sites_table.id = data_table.feed_id
      WHERE sites_table.id = #{params[:id]}
      order by datetime desc
      LIMIT (
        SELECT COUNT(DISTINCT(data_table.parameter))
        FROM "#{ENV["aqe_data_resource"]}" data_table
        WHERE data_table.feed_id = #{params[:id]}
      )
    EOS
    datastreams_data = sql_search_ckan(datastreams_sql)
    datastreams_data.each do |datastream|
      data[:datastreams][datastream["parameter"].to_sym] = datastream if datastream
    end    

    datastreams_aqi_asc = data[:datastreams].sort_by{|key,hash| hash["computed_aqi"].to_i}.last
    data[:prevailing_aqi] = datastreams_aqi_asc.last if datastreams_aqi_asc && !datastreams_aqi_asc.last["computed_aqi"].nil?


    if params[:include_recent_history]
      series = []
      recent_history_sql = "SELECT feed_id,parameter,datetime,value,unit from \"#{ENV["aqe_data_resource"]}\" WHERE feed_id = #{params[:id]} and datetime > current_date - 45 order by datetime "
      recent_history = sql_search_ckan(recent_history_sql).compact
      series_names = recent_history.map{|x| x["parameter"]}.uniq
      series_names.each do |series_name|
        series_datapoints = recent_history.select{|x| x["parameter"] == series_name}
        series << {
          :data => series_datapoints.map {|x| [x["datetime"].to_time.utc.change(:zone_offset => '0').to_i*1000,x["value"].to_f] },
          :name => "#{series_name} (#{series_datapoints.first["unit"]})" # assumption: all are the same for a given parameter
        } 
      end
      data[:recent_history] = series
    end
    return data.to_json
  end

  # View egg dashboard
  get '/egg/:id' do
    egg_sql = "SELECT id,feed,status,updated,location_domain,description,location_lon,location_lat,created,location_exposure,location_ele,title from \"#{ENV["aqe_site_resource"]}\" WHERE id = '#{params[:id]}'"
    @feed = sql_search_ckan(egg_sql).first

    redirect_with_error("Egg not found") if @feed.nil? 

    @datastreams = {}
    datastreams_sql = <<-EOS
      SELECT
        data_table.feed_id,data_table.datetime,data_table.parameter,data_table.value,data_table.unit,data_table.computed_aqi
      FROM
        "#{ENV["aqe_site_resource"]}" sites_table
      INNER JOIN "#{ENV["aqe_data_resource"]}" data_table ON sites_table.id = data_table.feed_id
      WHERE sites_table.id = #{params[:id]}
      order by datetime desc
      LIMIT (
        SELECT COUNT(DISTINCT(data_table.parameter))
        FROM "#{ENV["aqe_data_resource"]}" data_table
        WHERE data_table.feed_id = #{params[:id]}
      )
    EOS
    datastreams_data = sql_search_ckan(datastreams_sql)
    datastreams_data.each do |datastream|
      @datastreams[datastream["parameter"].to_sym] = datastream if datastream
    end


    datastreams_aqi_asc = @datastreams.sort_by{|key,hash| hash["computed_aqi"].to_i}.last
    @prevailing_aqi_component =datastreams_aqi_asc.last if datastreams_aqi_asc && !datastreams_aqi_asc.last["computed_aqi"].nil?

    @local_feed_path = "/eggs/nearby/#{@feed["location_lat"]}/#{@feed["location_lon"]}.json"
    erb :show
  end

  get '/eggs/nearby/:lat/:lon.json' do
    content_type :json
    redirect '/all_eggs.json'
    # @feeds = find_egg_feeds_near(@feed, params[:lat], params[:lon])
    # @feeds = @feeds.first(params[:limit].to_i) if params[:limit].to_i != 0
    # @map_markers = collect_map_markers(@feeds)
    # return @map_markers
  end

  get '/cache/flush' do
    return settings.cache.flush.to_s
  end

  private

  # def extract_feed_id_and_api_key_from_session
  #   [session['response_json']['feed_id'], session['response_json']['apikey']]
  # rescue
  #   redirect_with_error('Egg not found')
  # end

  def redirect_with_error(message)
    session['error'] = message
    redirect '/'
  end
end
