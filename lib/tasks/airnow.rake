require 'net/ftp'

namespace :airnow do
  
  namespace :epa_sites do
  
    desc "Download listing of EPA sites from AirNowAPI.org's FTP site"
    task :download_from_ftp do |t|
      raise "AirNow credentials not set (see README)" unless ENV['AIRNOW_USER'] && ENV['AIRNOW_PASS']
      Dir.mkdir("tmp")
      Dir.mkdir("tmp/data")
      ftp = Net::FTP.new('ftp.airnowapi.org')
      ftp.login(ENV['AIRNOW_USER'], ENV['AIRNOW_PASS'])
      puts "Downloading file into tmp/data/ dir..."
      ftp.getbinaryfile('Locations/monitoring_site_locations.dat', 'tmp/data/monitoring_site_locations-latest.dat', 1024)
      ftp.close
    end

    desc "Import EPA sites into app database"
    task :import_into_db do |t|
      puts "Opening and parsing file"
      puts "#{EpaSite.count} sites currently in EpaSite model"
      puts "Inserting/updating EPA sites"
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

end