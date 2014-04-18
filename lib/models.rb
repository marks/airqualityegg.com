require "sinatra/activerecord"

database = URI.parse(ENV['DATABASE_URL'] || "postgres://localhost/airquality")

ActiveRecord::Base.establish_connection(
  :adapter  => database.scheme == 'postgres' ? 'postgresql' : database.scheme,
  :host     => database.host,
  :username => database.user,
  :password => database.password,
  :database => database.path[1..-1],
  :encoding => 'utf8'
)

class EpaSite < ActiveRecord::Base
  self.primary_key = 'aqs_id'
  has_many :epa_datas, :foreign_key => :aqs_id
  
  scope :active, -> { where(:status => "Active") }

  def to_s
    site_name
  end

  def latest_daily_data
    self.epa_datas.find_by_sql(["SELECT T.id,T.date,T.parameter,T.unit,T.value,T.data_source FROM epa_data T INNER JOIN (SELECT epa_data.parameter, MAX (DATE) AS MaxDate FROM epa_data GROUP BY parameter) tm ON T.parameter = tm.parameter AND T.date = tm.MaxDate and T.aqs_id = ? and T.time is NULL",self.aqs_id])
  end

  def latest_hourly_data
    self.epa_datas.find_by_sql(["SELECT T.id,tm.MaxTimestamp AS date,T.parameter,T.unit,T.value,T.data_source FROM epa_data T INNER JOIN (SELECT epa_data. PARAMETER,  MAX((epa_data.date||' '||epa_data.time)::timestamp) as MaxTimestamp FROM epa_data GROUP BY PARAMETER) tm ON T . PARAMETER = tm. PARAMETER AND (T.date||' '||T.time)::timestamp = tm.MaxTimestamp AND T .aqs_id = ?",self.aqs_id])
  end

end

class EpaData < ActiveRecord::Base
  belongs_to :epa_site, :foreign_key => :aqs_id

  scope :recent, -> { where(:date => (Date.today-30).beginning_of_day..Date.today.end_of_day).order([:date => :asc, :time => :asc])}

  def hour
    self.time.nil? ? 0 : self.time.hour
  end

  def attributes
    new_attributes = super
    if new_attributes["parameter"] == "TEMP" && new_attributes["unit"] == "C"
      new_attributes["value"] = celsius_to_fahrenheit(new_attributes["value"])
      new_attributes["unit"] = "°F"
    end
    return new_attributes
  end

end
