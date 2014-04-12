require "sinatra/activerecord"

database = URI.parse("postgres://localhost/airquality" || ENV['DATABASE_URL'])

ActiveRecord::Base.establish_connection(
  :adapter  => database.scheme == 'postgres' ? 'postgresql' : database.scheme,
  :host     => database.host,
  :username => database.user,
  :password => database.password,
  :database => database.path[1..-1],
  :encoding => 'utf8'
)

class EpaSite < ActiveRecord::Base
end
