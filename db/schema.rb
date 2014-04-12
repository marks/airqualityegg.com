# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# Note that this schema.rb definition is the authoritative source for your
# database schema. If you need to create the application database on another
# system, you should be using db:schema:load, not running all the migrations
# from scratch. The latter is a flawed and unsustainable approach (the more migrations
# you'll amass, the slower it'll run and the greater likelihood for issues).
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema.define(version: 20140412211106) do

  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "epa_sites", id: false, force: true do |t|
    t.string   "aqs_id",       limit: 9
    t.string   "param",        limit: 10
    t.integer  "site_code"
    t.string   "site_name",    limit: 20
    t.string   "status",       limit: 8
    t.string   "agency_id",    limit: 4
    t.string   "agency_name",  limit: 60
    t.string   "epa_region",   limit: 2
    t.decimal  "lat"
    t.decimal  "lon"
    t.integer  "elevation"
    t.string   "gmt_offset",   limit: 3
    t.string   "country_code", limit: 2
    t.integer  "cmsa_code"
    t.string   "cmsa_name",    limit: 50
    t.integer  "msa_code"
    t.string   "msa_name",     limit: 50
    t.integer  "state_code",   limit: 2
    t.string   "state_name",   limit: 2
    t.string   "county_code",  limit: 9
    t.string   "county_name",  limit: 25
    t.string   "city_code",    limit: 9
    t.datetime "created_at"
    t.datetime "updated_at"
  end

end
