module AppHelpers

  def get_ckan_resource_by_name(name)
    search_raw = RestClient.get("#{ENV['CKAN_HOST']}/api/3/action/resource_search?query=name:#{URI.encode(name)}",{"X-CKAN-API-KEY" => ENV['CKAN_API_KEY']})
    search_results = JSON.parse(search_raw)
    search_results["result"]["results"].first
  end

  def sql_search_ckan(sql_query)
    results = []
    uri = "#{ENV['CKAN_HOST']}/api/3/action/datastore_search_sql?sql=#{URI.escape(sql_query)}"
    puts uri
    raw = RestClient.get(uri,{"X-CKAN-API-KEY" => ENV['CKAN_API_KEY']})
    response = JSON.parse(raw)
    if response["success"]
      response["result"]["records"].each do |row|
        results << transform_row(row)
      end
    end
    return results
  end

  def transform_row(row)
    row["aqi"] = determine_aqi(row["parameter"],row["value"],row["unit"]) if (row["parameter"] && row["value"] && row["unit"])
    row["unit"] = "%" if row["unit"] == "PERCENT"
    if (row["parameter"] == "TEMP" && row["unit"] == "C") or (row["parameter"] == "Temperature" && row["unit"] == "deg C")
      row["unit"] = "°F"
      row["value"] = celsius_to_fahrenheit(row["value"])
    end
    row = nil if row["value"].to_i == -2147483648
    return row
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

  def calculate_component_aqi(aqi_high,aqi_low,concentration_high, concentration_low, concentration)
    component_aqi = ((concentration-concentration_low)/(concentration_high-concentration_low))*(aqi_high-aqi_low)+aqi_low;
    return component_aqi.to_i
  end

  def calculate_aqi_from_CO(concentration)
    concentration = concentration.to_f
    if concentration >= 0 && concentration < 4.5
      aqi = calculate_component_aqi(50,0,4.4,0,concentration)
    elsif concentration >=4.5 && concentration<9.5
      aqi = calculate_component_aqi(100,51,9.4,4.5,concentration);
    elsif concentration>=9.5 && concentration<12.5
      aqi = calculate_component_aqi(150,101,12.4,9.5,concentration);
    elsif concentration>=12.5 && concentration<15.5
      aqi = calculate_component_aqi(200,151,15.4,12.5,concentration);
    elsif concentration>=15.5 && concentration<30.5
      aqi = calculate_component_aqi(300,201,30.4,15.5,concentration);
    elsif concentration>=30.5 && concentration<40.5
      aqi = calculate_component_aqi(400,301,40.4,30.5,concentration);
    elsif concentration>=40.5 && concentration<50.5
      aqi = calculate_component_aqi(500,401,50.4,40.5,concentration);
    else
      aqi = -1
    end
    return aqi
  end

  def calculate_aqi_from_PM25(concentration)
    concentration = concentration.to_f
    if concentration >= 0 && concentration < 12.1
      aqi = calculate_component_aqi(50,0,12,0,concentration)
    elsif concentration >=12.1 && concentration<35.5
      aqi = calculate_component_aqi(100,51,35.4,12.1,concentration);
    elsif concentration>=35.5 && concentration<55.5
      aqi = calculate_component_aqi(150,101,55.4,35.5,concentration);
    elsif concentration>=55.5 && concentration<150.5
      aqi = calculate_component_aqi(200,151,150.4,55.5,concentration);
    elsif concentration>=150.5 && concentration<250.5
      aqi = calculate_component_aqi(300,201,250.4,150.5,concentration);
    elsif concentration>=250.5 && concentration<350.5
      aqi = calculate_component_aqi(400,301,350.4,250.5,concentration);
    elsif concentration>=350.5 && concentration<500.5
      aqi = calculate_component_aqi(500,401,500.4,350.5,concentration);
    else
      aqi = -1
    end
    return aqi
  end




  def determine_aqi(parameter,value,unit)
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
      calculate_aqi_from_PM25(value)
    when "CO"
      value = value/1000.00 if unit.upcase == "PPB"
      return calculate_aqi_from_CO(value)
    when "NO2"
      value = value/1000.00 if unit.upcase == "PPB"
      value = value.round(3)
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

