require 'net/ftp'
require 'fileutils'

TODAY = Date.today.strftime("%Y%m%d")

# TODO refactor!

namespace :airnow do
  
  namespace :sites do
  
    desc "Download listing of sites from AirNowAPI.org's FTP site"
    task :download_from_ftp do |t|
      raise "AirNow credentials not set (see README)" unless ENV['AIRNOW_USER'] && ENV['AIRNOW_PASS']
      FileUtils.mkdir_p
      ftp = Net::FTP.new('ftp.airnowapi.org')
      ftp.login(ENV['AIRNOW_USER'], ENV['AIRNOW_PASS'])
      puts "Downloading file into tmp/data/ dir..."
      ftp.getbinaryfile('Locations/monitoring_site_locations.dat', 'tmp/data/monitoring_site_locations-latest.dat', 1024)
      ftp.close
    end

    desc "Import sites into app database"
    task :import_into_db do |t|
      puts "Opening and parsing file"
      puts "#{EpaSite.count} sites currently in EpaSite model"
      puts "Inserting/updating sites"
      CSV.foreach('tmp/data/monitoring_site_locations-latest.dat', :col_sep => "|", :encoding => 'ISO8859-1') do |raw_row|
        row = raw_row.map{|v| v.nil? ? nil : v.encode("UTF-8")}
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

    desc "Download file that has daily data for each site"
    task :download_from_ftp do |t|
      raise "AirNow credentials not set (see README)" unless ENV['AIRNOW_USER'] && ENV['AIRNOW_PASS']
      FileUtils.mkdir_p("tmp/data")
      ftp = Net::FTP.new('ftp.airnowapi.org')
      ftp.login(ENV['AIRNOW_USER'], ENV['AIRNOW_PASS'])
      puts "Downloading file into tmp/data/ dir..."
      ftp.getbinaryfile("DailyData/#{TODAY}-peak.dat", "tmp/data/#{TODAY}-peak.dat", 1024)
      ftp.close
    end


    desc "Import site data into app database"
    task :import_into_db do |t|
      puts "Opening and parsing file"
      puts "#{EpaData.count} sites currently in EpaData model"
      puts "Inserting/updating sites' data"
      CSV.foreach("tmp/data/#{TODAY}-peak.dat", :col_sep => "|", :encoding => 'ISO8859-1') do |raw_row|
        row = raw_row.map{|v| v.nil? ? nil : v.encode("UTF-8")}
        data_point = EpaData.find_or_create_by(:date => row[0], :aqs_id => row[1], :parameter => row[3])
        data_point.update_attributes!({
          :unit => row[4],
          :value => row[5],
          :data_source => row[7]
        })
      end
      puts "#{EpaData.count} sites in EpaData model now"
    end

  end

end