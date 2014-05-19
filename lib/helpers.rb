module AppHelpers

  def get_ckan_resource_by_name(name)
    search_raw = RestClient.get("#{ENV['CKAN_HOST']}/api/3/action/resource_search?query=name:#{URI.encode(name)}",{"X-CKAN-API-KEY" => ENV['CKAN_API_KEY']})
    search_results = JSON.parse(search_raw)
    search_results["result"]["results"].first
  end

  def sql_search_ckan(sql_query)
    uri = "#{ENV['CKAN_HOST']}/api/3/action/datastore_search_sql?sql=#{URI.escape(sql_query)}"
    puts uri
    raw = RestClient.get(uri,{"X-CKAN-API-KEY" => ENV['CKAN_API_KEY']})
    response = JSON.parse(raw)
    if response["success"]
      return response["result"]["records"]
    else
      return []
    end
  end

  def fetch_all_feeds
    page = 1
    all_feeds = []
    base_url = "#{$api_url}/v2/feeds.json?user=airqualityegg&mapped=true&content=summary&per_page=100"
    page_response = fetch_xively_url("#{base_url}&page=#{page}")
    while page_response.code == 200 && page_response["results"].size > 0
      page_results = Xively::SearchResult.new(page_response.body).results
      all_feeds = all_feeds + page_results
      page += 1
      page_response = fetch_xively_url("#{base_url}&page=#{page}")
    end
    all_feeds = collect_map_markers(all_feeds)
  end

  def fetch_xively_url(url)
    Xively::Client.get(url, :headers => {'Content-Type' => 'application/json', 'X-ApiKey' => $api_key})
  end

  def collect_map_markers(feeds)
    MultiJson.dump(
      feeds = feeds.collect do |feed|
        attributes = feed.attributes
        attributes["datastreams"] = attributes["datastreams"].select do |d|
          tags = d.tags
          tags.match(/computed/) && (tags.match(/sensor_type=NO2\z/) || tags.match(/sensor_type=CO\z/) || tags.match(/sensor_type=Dust\z/) || tags.match(/sensor_type=Temperature\z/) || tags.match(/sensor_type=Humidity\z/) || tags.match(/sensor_type=VOC\z/) || tags.match(/sensor_type=O3\z/) )
        end
        attributes.delete_if {|_,v| v.blank?}
        attributes
      end
    )
  end

  def string_to_time(timestamp)
    Time.parse(timestamp).strftime("%d %b %Y %H:%M:%S")
    rescue
    ''
  end

  def celsius_to_fahrenheit(value)
    value.to_f * 9 / 5 + 32
  end

  def determine_aqi_range(parameter,value,unit)
    case parameter
    when "OZONE-8HR"
      value = value/1000.00 if unit.upcase == "PPB"
      value = value.round(3)
      if value.between?(0,0.064)
        return [0,50]
      elsif value.between?(0.065,0.084)
        return [51,100]
      elsif value.between?(0.085,0.104)
        return [101,150]
      elsif value.between?(0.105,0.124)
        return [151,200]
      elsif value.between?(0.125,0.374)
        return [201,300]
      elsif value >= 0.375
        return [301,500]
      end
    when "OZONE-1HR"
      value = value/1000.00 if unit.upcase == "PPB"
      value = value.round(3)
      if value.between?(0,0.124)
        return [0,100]
      elsif value.between?(0.125,0.164)
        return [101,150]
      elsif value.between?(0.165,0.204)
        return [151,200]
      elsif value.between?(0.205,0.404)
        return [201,300]
      elsif value.between?(0.405,0.504)
        return [301,400]
      elsif value >= 0.505
        return [401,500]
      end
    when "PM2.5"
      vaule = value.round(1)
      if value.between?(0,15.4)
        return [0,51]
      elsif value.between?(15.5,40.4)
        return [51,100]
      elsif value.between?(40.5,65.4)
        return [101,150]
      elsif value.between?(65.5,150.4)
        return [151,200]
      elsif value.between?(150.5,250.4)
        return [201,300]
      elsif value.between?(250.5,350.4)
        return [301,400]
      elsif value >= 350.5
        return [401,500]
      end
    when "CO"
      value = value/1000.00 if unit.upcase == "PPB"
      value = value.round(3)
      if value.between?(0,4.4)
        return [0,50]
      elsif value.between?(4.5,9.4)
        return [51,100]
      elsif value.between?(9.5,12.4)
        return [101,150]
      elsif value.between?(12.5,15.4)
        return [151,200]
      elsif value.between?(15.5,30.4)
        return [201,300]
      elsif value.between?(30.5,40.4)
        return [301,400]
      elsif value >= 40.5
        return [401,500]
      end
    when "NO2"
      value = value/1000.00 if unit.upcase == "PPB"
      value = value.round(3)
      puts value
      if value.between?(0.65,1.24)
        return [201,300]
      elsif value.between?(1.25,1.64)
        return [301,400]
      elsif value >= 1.65
        return [401,500]
      end
    when "DUST"
      vaule = value.round(0)
      if value.between?(0,1500)
        return [0,50]
      elsif value.between?(1501,1529)
        return [50.5,50.5]
      elsif value.between?(1530,3000)
        return [51,100]
      elsif value.between?(3001,3059)
        return [100.5,100.5]
      elsif value.between?(3060,5837)
        return [101,150]
      elsif value.between?(5838,5892)
        return [150.5,150.5]
      elsif value.between?(5893,8670)
        return [151,200]
      elsif value.between?(8671,8726)
        return [200.5,200.5]
      elsif value.between?(8727,14336)
        return [201,300]
      elsif value.between?(14337,14364)
        return [300.5,300.5]
      elsif value >= 14365
        return [301,500]
      end      
    else
      return nil
    end 
  end

end

