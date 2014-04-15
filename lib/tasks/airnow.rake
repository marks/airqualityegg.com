require 'net/ftp'

TODAY = Date.today.strftime("%Y%m%d")
YESTERDAY = Date.yesterday.strftime("%Y%m%d")
HOURS = [1,5,9,13,17,21].map{|n| format('%02d', n)}

namespace :airnow do
  
  namespace :sites do
    desc "Open file that has monitoring site listings from FTP and import into app database"
    task :import do |t|
      raise "AirNow credentials not set (see README)" unless ENV['AIRNOW_USER'] && ENV['AIRNOW_PASS']

      ftp = Net::FTP.new('ftp.airnowapi.org')
      ftp.login(ENV['AIRNOW_USER'], ENV['AIRNOW_PASS'])
      ftp.passive = true # for Heroku
      puts "Opening file from FTP..."
      data = ftp.getbinaryfile('Locations/monitoring_site_locations.dat', nil, 1024)
      ftp.close

      puts "Before: #{EpaSite.count} sites currently in EpaSite model"
      puts "Parsing file..."
      puts "Inserting/updating sites"
      CSV.parse(data, :col_sep => "|", :encoding => 'ISO8859-1') do |row|
        site = EpaSite.find_or_create_by(:aqs_id => row[0])
        site.parameter = (site.parameter.to_s.split(",")+[row[1]]).uniq.join(",")
        site.assign_attributes({
          :site_code => row[2],
          :site_name => row[3],
          :status => row[4],
          :agency_id => row[5],
          :agency_name => row[6],
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
          :city_code => row[21]
        })
        site.save!
      end
      puts "#{EpaSite.count} sites in EpaSite model now"
    end
  end

  namespace :daily_data do
    desc "Open file that has daily data for each site from FTP and import into app database"
    task :import do |t|
      raise "AirNow credentials not set (see README)" unless ENV['AIRNOW_USER'] && ENV['AIRNOW_PASS']

      ftp = Net::FTP.new('ftp.airnowapi.org')
      ftp.login(ENV['AIRNOW_USER'], ENV['AIRNOW_PASS'])
      ftp.passive = true # for Heroku
      puts "Opening file from FTP..."
      data = ftp.getbinaryfile("DailyData/#{TODAY}-peak.dat", nil, 1024)
      ftp.close

      puts "Before: #{EpaData.count} data points currently in EpaData model"
      puts "Parsing file..."
      puts "Inserting/updating sites' data"
      CSV.parse(data, :col_sep => "|", :encoding => 'ISO8859-1') do |row|
        data_point = EpaData.find_or_create_by(:date => Time.strptime(row[0], "%m/%d/%y"), :aqs_id => row[1], :parameter => row[3])
        data_point.update_attributes!({
          :unit => row[4],
          :value => row[5],
          :data_source => row[7]
        })
      end
      puts "After: #{EpaData.count} data points in EpaData model now"
    end
  end

    namespace :hourly_data do
    desc "Open file that has daily data for each site from FTP and import into app database"
    task :import do |t|
      raise "AirNow credentials not set (see README)" unless ENV['AIRNOW_USER'] && ENV['AIRNOW_PASS']

      puts "Before: #{EpaData.count} data points currently in EpaData model"

      ftp = Net::FTP.new('ftp.airnowapi.org')
      ftp.login(ENV['AIRNOW_USER'], ENV['AIRNOW_PASS'])
      ftp.passive = true # for Heroku

      [TODAY,YESTERDAY].each  do |day|
        HOURS.each do |hour|
          file = "HourlyData/#{day}#{hour}.dat"
          begin
            puts "Getting #{file}"
            data = ftp.getbinaryfile(file, nil, 1024)
            puts "Processing #{file}"
            CSV.parse(data, :col_sep => "|", :encoding => 'ISO8859-1') do |row|
              if ["NO2T","NO2","NO2Y","CO","CO-8HR","RHUM","TEMP"].include?(row[5])
                data_point = EpaData.find_or_create_by(:date => Time.strptime(row[0], "%m/%d/%y"), :time => row[1], :aqs_id => row[2], :parameter => row[5])
                data_point.update_attributes!({
                  :unit => row[6],
                  :value => row[7],
                  :data_source => row[8]
                })
              end
            end
          rescue => e
            puts "ERROR: #{file} -- #{e} / #{e.message}"
          end
        end
      end

      ftp.close
      puts "After: #{EpaData.count} data points in EpaData model now"
    end
  end

end