namespace :ckan do 

  namespace :bikes do 

    task :update do 
      Rake.application.invoke_task("ckan:bikes:data:check_resource_exists_and_upsert")
    end

    namespace :data do

      desc "Create CKAN resource for data (if it doesn't exist) and then upsert CKAN"
      task :check_resource_exists_and_upsert do |t|
        raise "CKAN credentials not set (see README)" unless ENV['CKAN_HOST'] && ENV['CKAN_API_KEY']
        # search for CKAN data set
        search_raw = RestClient.get("#{ENV['CKAN_HOST']}/api/3/action/resource_search?query=name:#{URI.encode(ENV['CKAN_BIKE_DATA_RESOURCE_NAME'])}",{"X-CKAN-API-KEY" => ENV['CKAN_API_KEY']})
        search_results = JSON.parse(search_raw)
        # resource we want to use is the first match
        resource = search_results["result"]["results"].first
        create_resource_data = {
          :primary_key => 'id',
          :fields => [
            # {:id => "id", :type => "text"},
            # {:id => "bike_id", :type => "text"},
            # {:id => "datetime", :type => "timestamp"},
            # {:id => "parameter", :type => "text"},
            # {:id => "unit", :type => "text"},
            # {:id => "value", :type => "float"},
            # {:id => "lat", :type => "float"},
            # {:id => "lon", :type => "float"},
            # {:id => "computed_aqi", :type => "int"},

            # Julienne 6/22/14 "Route1" special format
            {:id => "id", :type => "text"},
            {:id => "bike_id", :type => "text"},
            {:id => "datetime", :type => "timestamp"},
            {:id => "lat", :type => "float"},
            {:id => "lon", :type => "float"},
            {:id => "O3_PPB", :type => "float"},
            {:id => "VOC_PPM", :type => "float"},
            {:id => "PART_UGM3", :type => "float"},
            {:id => "NO2_PPB", :type => "float"},
            {:id => "CO_PPM", :type => "float"},
            {:id => "TEMP_F", :type => "float"},
            {:id => "RHUM", :type => "float"},
            {:id => "SPEED_ms", :type => "float"},
          ],
          :records => []
        }
        if resource.nil? # if there is no resource, create it inside the right package
          # modify indexes here because we have added custom ones through pgsql 
          # create_resource_data[:indexes] = 'bike_id,datetime,parameter,unit,value,lat,lon,computed_aqi'
          # Julienne 6/22/14 "Route1" special format
          create_resource_data[:indexes] = 'bike_id,datetime,lat,long'
          create_resource_data[:resource] = {:package_id => ENV['CKAN_BIKE_DATASET_ID'], :name => ENV['CKAN_BIKE_DATA_RESOURCE_NAME'] }
        else # update existing resource
          create_resource_data[:resource_id] = resource["id"]
        end
        create_raw = RestClient.post("#{ENV['CKAN_HOST']}/api/3/action/datastore_create", create_resource_data.to_json,
          {"X-CKAN-API-KEY" => ENV['CKAN_API_KEY']})
        create_results = JSON.parse(create_raw)
        resource_id = create_results["result"]["resource_id"]
        puts "Created or updated a new resource named '#{ENV['CKAN_BIKE_DATA_RESOURCE_NAME']}' (resource id = #{resource_id}"
        # invoke upsert rake tasks
        Rake.application.invoke_task("ckan:bikes:data:upsert[#{resource_id}]")
      end

      desc "Get relevant datastreams from each bike feed and store in CKAN"
      task :upsert, :resource_id do |t, args|
        raise "CKAN resource ID not set" if args[:resource_id].nil?

        data = File.read("/Users/mark/Box\ Sync/Louisville\ Community\ Data/MiscFiles/From\ DurhamLabs/Route1-avgsByJulienne-2014-06-22-fixed.csv")
        CSV.parse(data, :col_sep => ",", :headers => true) do |row|

          monitoring_data = {
            # :bike_id => row["BIKE_ID"],
            # :datetime => row["DATETIME"],
            # :lat => row["LAT"],
            # :lon => row["LONG"],
            # :value => row["VALUE"].to_f,
            # :parameter => row["SENSOR"],
            # :unit => row["UNITS"]

            # Julienne 6/22/14 "Route1" special format
            :bike_id => "A2",
            # :datetime => row["DATETIME"]+"5Z", # because it was averaged every 10 seconds by Julienne
            :lat => row["LAT"],
            :lon => row["LONG"],
            :O3_PPB => row["Ozone PPB"],
            :VOC_PPM => row["Volatile Organics PPM"],
            :PART_UGM3 => row["Particulate UG/M3"],
            :NO2_PPB => row["Nitrogen Dioxide PPB"],
            :CO_PPM => row["Carbon Monoxide PPM"],
            :TEMP_F => row["Temperature F"],
            :RHUM => row["Humdity %"],
            :SPEED_ms => row["SPEED m/s"]
          }

          # monitoring_data[:computed_aqi] = determine_aqi(monitoring_data[:parameter], monitoring_data[:value], monitoring_data[:unit])
          # monitoring_data[:id] = "#{monitoring_data[:bike_id]}|#{monitoring_data[:datetime]}|#{monitoring_data[:parameter]}"
          # Julienne 6/22/14 "Route1" special format
          monitoring_data[:id] = "#{monitoring_data[:bike_id]}|#{monitoring_data[:datetime]}|#{monitoring_data[:lat]}||#{monitoring_data[:lon]}"
          post_data = {:resource_id => args[:resource_id], :records => [monitoring_data], :method => 'upsert'}.to_json
          upsert_raw = RestClient.post("#{ENV['CKAN_HOST']}/api/3/action/datastore_upsert", post_data, {"X-CKAN-API-KEY" => ENV['CKAN_API_KEY']})
          upsert_result = JSON.parse(upsert_raw)
        end

        puts "\nBike data upserts complete"
      end
    end
    
  end

end