module AppHelpers

  def get_ckan_resource_by_name(name)
    search_raw = RestClient.get("#{ENV['CKAN_HOST']}/api/3/action/resource_search?query=name:#{URI.encode(name)}",{"X-CKAN-API-KEY" => ENV['CKAN_API_KEY']})
    search_results = JSON.parse(search_raw)
    if search_results["result"]["results"] != []
      return search_results["result"]["results"].first
    else
      return {}
    end
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
    row["computed_aqi"] = determine_aqi(row["parameter"],row["value"],row["unit"]) if !row["computed_aqi"] && (row["parameter"] && row["value"] && row["unit"])
    row["aqi_cat"] = aqi_to_category(row["computed_aqi"]) if row["computed_aqi"]
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
      aqi = nil
    end
    return aqi
  end

  def calculate_aqi_from_PM25_24hr(concentration)
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
      aqi = nil
    end
    return aqi
  end

  def calculate_aqi_from_PM10_24hr(concentration)
    concentration = concentration.to_f
    if concentration >= 0 && concentration < 55
      aqi = calculate_component_aqi(50,0,54,0,concentration)
    elsif concentration >=55 && concentration<155
      aqi = calculate_component_aqi(100,51,154,55,concentration);
    elsif concentration>=155 && concentration<255
      aqi = calculate_component_aqi(150,101,254,155,concentration);
    elsif concentration>=255 && concentration<355
      aqi = calculate_component_aqi(200,151,354,255,concentration);
    elsif concentration>=355 && concentration<425
      aqi = calculate_component_aqi(300,201,424,355,concentration);
    elsif concentration>=425 && concentration<505
      aqi = calculate_component_aqi(400,301,504,425,concentration);
    elsif concentration>=505 && concentration<605
      aqi = calculate_component_aqi(500,401,604,505,concentration);
    else
      aqi = nil
    end
    return aqi
  end

  def calculate_aqi_from_SO2_1hr(concentration)
    concentration = concentration.to_i
    if concentration >= 0 && concentration < 36
      aqi = calculate_component_aqi(50,0,35,0,concentration)
    elsif concentration >=36 && concentration<76
      aqi = calculate_component_aqi(100,51,75,36,concentration);
    elsif concentration>=76 && concentration<186
      aqi = calculate_component_aqi(150,101,185,76,concentration);
    elsif concentration>=186 && concentration<304
      aqi = calculate_component_aqi(200,151,304,186,concentration);
    else
      aqi = nil # AQI values of 201 or greater are calculated with 24-hour SO2 concentrations
    end
    return aqi
  end

  def calculate_aqi_from_SO2_24hr(concentration)
    concentration = concentration.to_i
    if concentration >= 0 && concentration < 304
      aqi = nil # AQI values less than 201 are calculated with 1-hour SO2 concentrations
    elsif concentration>=304 && concentration<605
      aqi = calculate_component_aqi(300,201,604,305,concentration);
    elsif concentration>=605 && concentration<805
      aqi = calculate_component_aqi(400,301,804,605,concentration);
    elsif concentration>=805 && concentration<1004
      aqi = calculate_component_aqi(500,401,1004,805,concentration);
    else
      aqi = nil
    end
    return aqi
  end


  def calculate_aqi_from_O3_8hr(concentration)
    concentration = concentration.to_f
    if concentration >= 0 && concentration < 0.060
      aqi = calculate_component_aqi(50,0,0.059,0,concentration)
    elsif concentration >=0.060 && concentration<0.076
      aqi = calculate_component_aqi(100,51,0.075,0.060,concentration);
    elsif concentration>=0.076 && concentration<0.096
      aqi = calculate_component_aqi(150,101,0.095,0.076,concentration);
    elsif concentration>=0.096 && concentration<0.116
      aqi = calculate_component_aqi(200,151,0.115,0.096,concentration);
    elsif concentration>=0.116 && concentration<0.375
      aqi = calculate_component_aqi(300,201,0.374,0.116,concentration);
    elsif concentration>=0.375 && concentration<0.605
      aqi = nil # 8-hour ozone values do not define higher AQI values (>=301).  AQI values of 301 or greater are calculated with 1-hour ozone concentrations.
    else
      aqi = nil
    end
    return aqi
  end

  def calculate_aqi_from_O3_1hr(concentration)
    concentration = concentration.to_f
    if concentration >= 0.125 && concentration < 0.165
      aqi = calculate_component_aqi(150,101,0.164,0.125,concentration);
    elsif concentration>=0.165 && concentration<0.205
      aqi = calculate_component_aqi(200,151,0.204,0.165,concentration);
    elsif concentration>=0.205 && concentration<0.405
      aqi = calculate_component_aqi(300,201,0.404,0.205,concentration);
    elsif concentration>=0.405 && concentration<0.505
      aqi = calculate_component_aqi(400,301,0.504,0.405,concentration);
    elsif concentration>=0.505 && concentration<0.605
      aqi = calculate_component_aqi(500,401,0.604,0.505,concentration);
    else
      aqi = nil
    end
    return aqi
  end

    def calculate_aqi_from_NO2(concentration)
    concentration = concentration.to_f
    if concentration >= 0 && concentration < 0.054
      aqi = calculate_component_aqi(50,0,0.053,0,concentration)
    elsif concentration >=0.054 && concentration<0.101
      aqi = calculate_component_aqi(100,51,0.100,0.054,concentration);
    elsif concentration>=0.101 && concentration<0.361
      aqi = calculate_component_aqi(150,101,0.360,0.101,concentration);
    elsif concentration>=0.361 && concentration<0.650
      aqi = calculate_component_aqi(200,151,0.649,0.361,concentration);
    elsif concentration>=0.650 && concentration<1.250
      aqi = calculate_component_aqi(300,201,1.249,0.650,concentration);
    elsif concentration>=1.250 && concentration<1.650
      aqi = calculate_component_aqi(400,301,1.649,1.250,concentration);
    elsif concentration>=1.650 && concentration<2.049
      aqi = calculate_component_aqi(500,401,2.049,1.650,concentration);
    else
      aqi = nil
    end
    return aqi
  end


  def determine_aqi(parameter,value,unit)
    case parameter.upcase
    when "OZONE-8HR"
      value = value/1000.00 if unit.upcase == "PPB"
      return calculate_aqi_from_O3_8hr(value)
    when "OZONE-1HR"
      value = value/1000.00 if unit.upcase == "PPB"
      return calculate_aqi_from_O3_1hr(value)
    when "PM10-24HR"
      return calculate_aqi_from_PM10_24hr(value)
    when "PM2.5-24HR"
      return calculate_aqi_from_PM25_24hr(value)
    when "CO"
      value = value/1000.00 if unit.upcase == "PPB"
      return calculate_aqi_from_CO(value)
    when "NO2"
      value = value/1000.00 if unit.upcase == "PPB"
      value = value.round(3)
      return calculate_aqi_from_NO2(value)
    when "DUST"
      vaule = value.round
      if value == 0
        aqi_range = [0,0]
      elsif value.between?(1,1500)
        aqi_range = [0,50]
      elsif value.between?(1501,1529)
        aqi_range = [50.5,50.5]
      elsif value.between?(1530,3000)
        aqi_range = [51,100]
      elsif value.between?(3001,3059)
        aqi_range = [100.5,100.5]
      elsif value.between?(3060,5837)
        aqi_range = [101,150]
      elsif value.between?(5838,5892)
        aqi_range = [150.5,150.5]
      elsif value.between?(5893,8670)
        aqi_range = [151,200]
      elsif value.between?(8671,8726)
        aqi_range = [200.5,200.5]
      elsif value.between?(8727,14336)
        aqi_range = [201,300]
      elsif value.between?(14337,14364)
        aqi_range = [300.5,300.5]
      elsif value >= 14365
        aqi_range = [301,500]
      end   
      return aqi_range.sum/2.00   
    else
      return nil
    end 
  end

  def aqi_to_category(aqi)
    aqi = aqi.to_i
    if aqi <= 0
      return {:name => "Out of range", :color => "#FFF", :font => "#000"}
    elsif aqi <= 50
      return {:name => "Good", :color => "#00E000", :font => "#000"}
    elsif aqi > 50 && aqi <= 100
      return {:name => "Moderate", :color => "#FFFF00", :font => "#000"}
    elsif aqi > 100 && aqi <= 150
      return {:name => "Unhealthy for Sensitive Groups", :color => "#FF7E00", :font => "#000"}
    elsif aqi > 150 && aqi <= 200
      return {:name => "Unhealthy", :color => "#FF0000", :font => "#000"}
    elsif aqi > 200 && aqi <= 300
      return {:name => "Very Unhealthy", :color => "#99004C", :font => "#FFF"}
    elsif aqi > 300 
      return {:name => "Hazardous", :color => "#4C0026", :font => "#FFF"}
    end
  end

end

