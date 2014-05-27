require 'rubygems'
require 'bundler/setup'
require 'sinatra/base'
require 'sinatra/reloader' if Sinatra::Base.development?
require "sinatra/multi_route"
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


META = {}
# set some metadata # todo - cleanup
["aqs","aqe","jeffschools"].each do |key|
  META[key] = get_ckan_package_by_slug(ENV["CKAN_#{key.upcase}_DATASET_ID"])
  META[key]["site_resource_id"] = get_ckan_resource_by_name(ENV["CKAN_#{key.upcase}_SITE_RESOURCE_NAME"])["id"] if ENV["CKAN_#{key.upcase}_SITE_RESOURCE_NAME"]
  META[key]["data_resource_id"] = get_ckan_resource_by_name(ENV["CKAN_#{key.upcase}_DATA_RESOURCE_NAME"])["id"] if ENV["CKAN_#{key.upcase}_DATA_RESOURCE_NAME"]
end

class AirQualityEgg < Sinatra::Base
  register Sinatra::MultiRoute

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
    set :cache_time, 3600*3 # 3 hours
  end

  configure :development do
    $stdout.sync = true
    set :logging, Logger::DEBUG
    register Sinatra::Reloader
    also_reload "lib/*.rb"
    set :cache_time, 3600*12 
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
      "SELECT id,feed,status,updated,location_domain,description,location_lon,location_lat,created,location_exposure,location_ele,title from \"#{META["aqe"]["site_resource_id"]}\" WHERE id = '#{id}'"
    end

    def sql_for_aqs_site(id)
      "SELECT status,msa_name,elevation,aqs_id,county_name,lat,lon,gmt_offset,agency_name,cmsa_name,site_name,state_name,epa_region,country_code from \"#{META["aqs"]["site_resource_id"]}\" WHERE aqs_id = '#{id}'"
    end

    def sql_for_aqs_datastreams(id)
      <<-EOS
        SELECT
          data_table.aqs_id,data_table.date, data_table.time,data_table.parameter,data_table.value,data_table.unit,data_table.computed_aqi
        FROM "#{META["aqs"]["data_resource_id"]}" data_table
        WHERE data_table.aqs_id = '#{id}'
        ORDER BY date desc,time desc
        LIMIT (
          SELECT COUNT(DISTINCT(data_table.parameter))
          FROM "#{META["aqs"]["data_resource_id"]}" data_table
          WHERE data_table.aqs_id = '#{id}'
        )
      EOS
    end

    def sql_for_average_over_days(table, id,n_days)
      if table == "aqe"
        "SELECT parameter, AVG(value) AS avg_value, AVG(computed_aqi) AS avg_aqi FROM \"#{META["#{table}"]["data_resource_id"]}\" WHERE feed_id=#{id} AND datetime >= current_date - #{n_days} GROUP BY parameter"
      else #aqs
        "SELECT parameter, AVG(value) AS avg_value, AVG(computed_aqi) AS avg_aqi FROM \"#{META["#{table}"]["data_resource_id"]}\" WHERE aqs_id='#{id}' AND date >= current_date - #{n_days} GROUP BY parameter"      
      end
    end

    def sql_for_aqe_datastreams(id)
      <<-EOS
        SELECT
          data_table.feed_id,data_table.datetime,data_table.parameter,data_table.value,data_table.unit,data_table.computed_aqi
        FROM
          "#{META["aqe"]["site_resource_id"]}" sites_table
        INNER JOIN "#{META["aqe"]["data_resource_id"]}" data_table ON sites_table.id = data_table.feed_id
        WHERE sites_table.id = #{id}
        order by datetime desc
        LIMIT (
          SELECT COUNT(DISTINCT(data_table.parameter))
          FROM "#{META["aqe"]["data_resource_id"]}" data_table
          WHERE data_table.feed_id = #{id}
        )
      EOS
    end

    def sql_for_aqe_latest_datapoint(id)
      <<-EOS
        SELECT
          data_table.datetime
        FROM
          "#{META["aqe"]["data_resource_id"]}" data_table
        WHERE data_table.feed_id = #{id}
        order by datetime desc
        LIMIT 1
      EOS
    end

    def sql_for_all_sites_by_key(key)
      if key == "aqe"
        <<-EOS
          SELECT site_table.id,site_table.created,site_table.description,site_table.location_domain,site_table.location_ele,site_table.location_exposure,site_table.location_lat,site_table.location_lon,site_table.title,
          (SELECT data_table.datetime FROM \"#{META["aqe"]["data_resource_id"]}\" data_table WHERE data_table.feed_id = site_table.id and data_table.datetime > current_date - 2 order by datetime desc LIMIT 1) AS last_datapoint
          from \"#{META["aqe"]["site_resource_id"]}\" site_table
        EOS
      else
        "SELECT * from \"#{META[key]["site_resource_id"]}\" #{META[key]["extras_hash"]["default_conditions"]}"
      end
    end

  end


  # Render css from scss
  get '/style.css' do
    scss :style
  end

  # Home page
  get '/' do
    @local_feed_path = '/all_eggs.geojson'
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

  get '/ckan_proxy/:key.geojson' do
    key = params[:key]
    content_type :json
    cache_key = "ckan_proxy/#{key}.geojson"
    cached_data = settings.cache.fetch(cache_key) do
      puts 
      all_aqe_sites = sql_search_ckan(sql_for_all_sites_by_key(key))
      geojson = []
      all_aqe_sites.each do |feature|
        geojson << {
            :"type" => "Feature",
            :"properties" => feature.merge("type" => key, "id" => feature[META[key]["extras_hash"]["field_containing_site_id"]]),
            :"geometry" => {
                "type" =>  "Point",
                "coordinates" => [feature[META[key]["extras_hash"]["field_containing_longitude"]], feature[META[key]["extras_hash"]["field_containing_latitude"]]]
            }
        }
      end
      geojson = geojson.to_json
      # store in cache and return
      settings.cache.set(cache_key, geojson, settings.cache_time)
      geojson
    end
    return cached_data
  end

  get '/aqs/:id.json' do
    content_type :json

    data = sql_search_ckan(sql_for_aqs_site(params[:id])).first

    data[:datastreams] = {}
    datastreams_sql = sql_for_aqs_datastreams(params[:id])
    datastreams_data = sql_search_ckan(datastreams_sql)
    datastreams_data.each do |datastream|
      data[:datastreams][datastream["parameter"].to_sym] = datastream if datastream
    end

    datastreams_aqi_asc = data[:datastreams].sort_by{|key,hash| hash["computed_aqi"].to_i}.last
    data[:prevailing_aqi] = datastreams_aqi_asc.last if datastreams_aqi_asc && !datastreams_aqi_asc.last["computed_aqi"].nil?

    if params[:include_averages]
      data[:averages] = {}
      [0, 3, 7, 28].each do |days|
        data[:averages][days] = {}
        results = sql_search_ckan(sql_for_average_over_days("aqs",params[:id], days))
        results.each do |result|
          data[:averages][days][result["parameter"].to_sym] = result
        end
      end
    end

    if params[:include_recent_history]
      series = []
      recent_history_sql = "SELECT * from \"#{META["aqs"]["data_resource_id"]}\" WHERE aqs_id = '#{params[:id]}' and date > current_date - 45 order by date, time "
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

  get '/aqs/:id' do
    @site = sql_search_ckan(sql_for_aqs_site(params[:id])).first

    redirect_with_error("AQS site not found") if @site.nil? 

    @datastreams = {}
    datastreams_sql = sql_for_aqs_datastreams(params[:id])
    datastreams_data = sql_search_ckan(datastreams_sql)
    datastreams_data.each do |datastream|
      @datastreams[datastream["parameter"].to_sym] = datastream if datastream
    end

    @averages = {}
    [0, 3, 7, 28].each do |days|
      @averages[days] = {}
      results = sql_search_ckan(sql_for_average_over_days("aqs",params[:id], days))
      results.each do |result|
        @averages[days][result["parameter"].to_sym] = result
      end
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
      recent_history_sql = "SELECT feed_id,parameter,datetime,value,unit from \"#{META["aqe"]["data_resource_id"]}\" WHERE feed_id = #{params[:id]} and datetime > current_date - 45 order by datetime "
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
        results = sql_search_ckan(sql_for_average_over_days("aqe",params[:id], days))
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
      results = sql_search_ckan(sql_for_average_over_days("aqe",params[:id], days))
      results.each do |result|
        @averages[days][result["parameter"].to_sym] = result
      end
    end

    @local_feed_path = "/eggs/nearby/#{@site["location_lat"]}/#{@site["location_lon"]}.json"
    erb :show_aqe
  end
  end


  route :get, :post, '/compare' do
    @sensors = []
    params.each do |type,ids|
      ids.split(",").each do |sensor_id|
        @sensors << {"type" => type, "id" => sensor_id}
      end
      @sensors.uniq.compact!
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
