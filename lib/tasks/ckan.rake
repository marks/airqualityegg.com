require 'net/ftp'
require 'rest-client'
require 'json'

TODAY = Date.today.strftime("%Y%m%d")
YESTERDAY = Date.yesterday.strftime("%Y%m%d")
HOURS = (0..24).map{|n| format('%02d', n)}

namespace :ckan do 

  namespace :airnow do

    namespace :sites do

      desc "Create CKAN resource (if it doesn't exist) and then upsert CKAN"
      task :check_resource_exists_and_upsert do |t|
        raise "CKAN credentials not set (see README)" unless ENV['CKAN_HOST'] && ENV['CKAN_API_KEY']
        # search for CKAN data set
        search_raw = RestClient.get("http://localhost:5000/api/3/action/resource_search?query=name:#{URI.encode(ENV['CKAN_AQS_SITE_RESOURCE_NAME'])}",{"X-CKAN-API-KEY" => ENV['CKAN_API_KEY']})
        search_results = JSON.parse(search_raw)
        # resource we want to use is the first match
        resource = search_results["result"]["results"].first
        # if there is no resource, create it
        if resource.nil?
          create_raw = RestClient.post("#{ENV['CKAN_HOST']}/api/3/action/datastore_create",
            {:resource => {
                :package_id => ENV['CKAN_AQS_DATASET_ID'],
                :name => ENV['CKAN_AQS_SITE_RESOURCE_NAME']
              },
              :primary_key => 'aqs_id',
              # :indexes => 'aqs_id,site_name,status,cmsa_name,msa_name,state_name,county_name',
              :fields => [
                {:id => "aqs_id", :type => "text"},
                {:id => "site_code", :type => "text"},
                {:id => "site_name", :type => "text"},
                {:id => "status", :type => "text"},
                {:id => "agency_id", :type => "text"},
                {:id => "agency_name", :type => "text"},
                {:id => "epa_region", :type => "text"},
                {:id => "lat", :type => "float"},
                {:id => "lon", :type => "float"},
                {:id => "elevation", :type => "text"},
                {:id => "gmt_offset", :type => "text"},
                {:id => "country_code", :type => "text"},
                {:id => "cmsa_code", :type => "text"},
                {:id => "cmsa_name", :type => "text"},
                {:id => "msa_code", :type => "text"},
                {:id => "msa_name", :type => "text"},
                {:id => "state_code", :type => "text"},
                {:id => "state_name", :type => "text"},
                {:id => "county_code", :type => "text"},
                {:id => "county_name", :type => "text"},
                {:id => "city_code", :type => "text"},
                {:id => "geojson", :type => "json"},
              ],
              :records => []
            }.to_json,
            {"X-CKAN-API-KEY" => ENV['CKAN_API_KEY']})
          create_results = JSON.parse(create_raw)
          resource_id = create_results["result"]["resource_id"]
          puts "Created a new resource named '#{ENV['CKAN_AQS_SITE_RESOURCE_NAME']}'"
        else
          resource_id = resource["id"]
          puts "Resource named '#{ENV['CKAN_AQS_SITE_RESOURCE_NAME']}' already existed"
        end
        puts "Resource ID = #{resource_id}"
        # invoke upsert rake task
        Rake.application.invoke_task("ckan:airnow:sites:upsert[#{resource_id}]")
      end


      desc "Open file that has monitoring site listings from FTP and import into CKAN"
      task :upsert, :resource_id do |t, args|
        raise "AQS Monitoring Site CKAN resource ID not set" if args[:resource_id].nil?
        raise "AirNow credentials not set (see README)" unless ENV['AIRNOW_USER'] && ENV['AIRNOW_PASS']

        # connect to FTP and load the data into a variable
        ftp = Net::FTP.new('ftp.airnowapi.org')
        ftp.login(ENV['AIRNOW_USER'], ENV['AIRNOW_PASS'])
        ftp.passive = true
        puts "Opening file from FTP..."
        data = ftp.getbinaryfile('Locations/monitoring_site_locations.dat', nil, 1024)
        ftp.close

        # site_records = []
        puts "Parsing file and upserting rows..."
        CSV.parse(data, :col_sep => "|", :encoding => 'UTF-8') do |row|
          puts row[0]
          site_data = {
            :aqs_id => row[0],
            :site_code => row[2],
            :site_name => row[3].encode('UTF-8', 'binary', invalid: :replace, undef: :replace, replace: '???').gsub(";"," "),
            :status => row[4],
            :agency_id => row[5],
            :agency_name => row[6].encode('UTF-8', 'binary', invalid: :replace, undef: :replace, replace: '???'),
            :epa_region => row[7],
            :lat => row[8],
            :lon => row[9],
            :elevation => row[10],
            :gmt_offset => row[11],
            :country_code => row[12],
            :cmsa_code => row[13],
            :cmsa_name => row[14],
            :msa_code => row[15],
            :msa_name => row[16],
            :state_code => row[17],
            :state_name => row[18],
            :county_code => row[19],
            :county_name => row[20],
            :city_code => row[21],
            :geojson => {:type => 'Point', :coordinates => [row[9], row[8]] }
          }
          post_data = {:resource_id => args[:resource_id], :records => [site_data], :method => 'upsert'}.to_json
          upsert_raw = RestClient.post("#{ENV['CKAN_HOST']}/api/3/action/datastore_upsert", post_data, {"X-CKAN-API-KEY" => ENV['CKAN_API_KEY']})
          upsert_result = JSON.parse(upsert_raw)
        end

        puts "\nAQS Monitoring Sites data upserts complete"

      end
    end



  end

end