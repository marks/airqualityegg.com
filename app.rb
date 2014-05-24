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

    def sql_for_aqe_site(id)
      "SELECT id,feed,status,updated,location_domain,description,location_lon,location_lat,created,location_exposure,location_ele,title from \"#{ENV["aqe_site_resource"]}\" WHERE id = '#{id}'"
    end

    def sql_for_aqs_site(id)
      "SELECT status,msa_name,elevation,aqs_id,county_name,lat,lon,gmt_offset,agency_name,cmsa_name,site_name from \"#{ENV["aqs_site_resource"]}\" WHERE aqs_id = '#{id}'"
    end

    def sql_for_aqs_datastreams(id)
      <<-EOS
        SELECT
          data_table.aqs_id,data_table.date, data_table.time,data_table.parameter,data_table.value,data_table.unit,data_table.computed_aqi
        FROM "#{ENV["aqs_data_resource"]}" data_table
        WHERE data_table.aqs_id = '#{id}'
        ORDER BY date desc,time desc
        LIMIT (
          SELECT COUNT(DISTINCT(data_table.parameter))
          FROM "#{ENV["aqs_data_resource"]}" data_table
          WHERE data_table.aqs_id = '#{id}'
        )
      EOS
    end

    def sql_for_aqe_average_over_days(id,n_days)
      "SELECT parameter, AVG(value) AS avg_value, AVG(computed_aqi) AS avg_aqi FROM \"#{ENV["aqe_data_resource"]}\" WHERE feed_id=#{id} AND datetime > current_date - #{n_days} GROUP BY parameter"
    end

    def sql_for_aqe_datastreams(id)
      <<-EOS
        SELECT
          data_table.feed_id,data_table.datetime,data_table.parameter,data_table.value,data_table.unit,data_table.computed_aqi
        FROM
          "#{ENV["aqe_site_resource"]}" sites_table
        INNER JOIN "#{ENV["aqe_data_resource"]}" data_table ON sites_table.id = data_table.feed_id
        WHERE sites_table.id = #{id}
        order by datetime desc
        LIMIT (
          SELECT COUNT(DISTINCT(data_table.parameter))
          FROM "#{ENV["aqe_data_resource"]}" data_table
          WHERE data_table.feed_id = #{id}
        )
      EOS

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

    data = sql_search_ckan(sql_for_aqs_site(params[:aqs_id])).first

    data[:datastreams] = {}
    datastreams_sql = sql_for_aqs_datastreams(params[:aqs_id])
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
    @site = sql_search_ckan(sql_for_aqs_site(params[:aqs_id])).first

    redirect_with_error("AQS site not found") if @site.nil? 

    @datastreams = {}
    datastreams_sql = sql_for_aqs_datastreams(params[:aqs_id])
    datastreams_data = sql_search_ckan(datastreams_sql)
    datastreams_data.each do |datastream|
      @datastreams[datastream["parameter"].to_sym] = datastream if datastream
    end    

    datastreams_aqi_asc = @datastreams.sort_by{|key,hash| hash["computed_aqi"].to_i}.last
    @prevailing_aqi_component = datastreams_aqi_asc.last if datastreams_aqi_asc && !datastreams_aqi_asc.last["computed_aqi"].nil?

    @local_feed_path = "/eggs/nearby/#{@site["lat"]}/#{@site["lon"]}.json"
    erb :show_aqs
  end

  ['/egg/:id.json','/aqe/:id.json'].each do |path|
  get path do
    content_type :json

    data = sql_search_ckan(sql_for_aqe_site(params[:id])).first

    data[:datastreams] = {}
    datastreams_sql = sql_for_aqe_datastreams(params[:id]) 
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

    if params[:include_averages]
      data[:averages] = {}
      [0, 3, 7, 28].each do |days|
        data[:averages][days] = {}
        results = sql_search_ckan(sql_for_aqe_average_over_days(params[:id], days))
        results.each do |result|
          data[:averages][days][result["parameter"].to_sym] = result
        end
      end
    end

    return data.to_json
  end
  end

  # View egg dashboard
  ['/egg/:id','/aqe/:id'].each do |path|
  get path do
    @site = sql_search_ckan(sql_for_aqe_site(params[:id])).first

    redirect_with_error("Egg not found") if @site.nil? 

    @datastreams = {}
    datastreams_sql = sql_for_aqe_datastreams(params[:id]) 
    datastreams_data = sql_search_ckan(datastreams_sql)
    datastreams_data.each do |datastream|
      @datastreams[datastream["parameter"].to_sym] = datastream if datastream
    end

    datastreams_aqi_asc = @datastreams.sort_by{|key,hash| hash["computed_aqi"].to_i}.last
    @prevailing_aqi_component =datastreams_aqi_asc.last if datastreams_aqi_asc && !datastreams_aqi_asc.last["computed_aqi"].nil?

    @averages = {}
    [0, 3, 7, 28].each do |days|
      @averages[days] = {}
      results = sql_search_ckan(sql_for_aqe_average_over_days(params[:id], days))
      results.each do |result|
        @averages[days][result["parameter"].to_sym] = result
      end
    end

    @local_feed_path = "/eggs/nearby/#{@site["location_lat"]}/#{@site["location_lon"]}.json"
    erb :show_aqe
  end
  end

  get '/compare' do
    @sensors = []
    params.each do |type,ids|
      ids.split(",").each do |sensor_id|
        begin
        @sensors << case type.downcase
        when "aqe"
          sql_search_ckan(sql_for_aqe_site(sensor_id)).first.merge("type" => type, "id" => sensor_id)
        when "aqs"
          sql_search_ckan(sql_for_aqs_site(sensor_id)).first.merge("type" => type, "id" => sensor_id)
        else
          nil
        end
        rescue
        end
      end
      @sensors.compact!
    end
    erb :compare
  end



  get '/data-explorer' do
    erb :data_explorer
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
  def redirect_with_error(message)
    session['error'] = message
    redirect '/'
  end
end
