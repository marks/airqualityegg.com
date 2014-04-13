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
end
