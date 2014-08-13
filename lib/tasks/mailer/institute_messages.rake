namespace :mailer do 

  namespace :institute_messages do

		CKAN_INSTITUTE_MESSAGES_RESOURCE_ID = META["institute_messages"]["resources"].first["id"]
		CTCT_LIST_ID = ENV['CONSTANTCONTACT_LIST_ID']


  	task :breaking do

  		# Get latest observations and order them
  		observations_url = "http://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude=#{ENV['FOCUS_CITY_LAT']}&longitude=#{ENV['FOCUS_CITY_LON']}&distance=25&API_KEY=#{ENV["AIRNOW_API_KEY"]}"
		  observations_data = JSON.parse(RestClient.get(observations_url))
		  observations = observations_data.map do |result|
		    result["aqi_cat"] = category_number_to_category(result["Category"]["Number"])
		    result["observation_at"] = Time.parse("#{result["DateObserved"]} #{result["HourObserved"]}:00 #{result["LocalTimeZone"]}").utc
		    result
		  end

		  exit if observations.empty?

		  observations = observations.sort_by{|x| -x["AQI"]}

		  # See if the highest observation is more severe than moderate (category number 2)
		  highest_observation = observations.first
		  if highest_observation["Category"]["Number"].to_i > 2
		  	# if there are observations more severe than moderate, check to see if we have sent an email within the past 4 hours
		  	last_email_sent_sql = "SELECT EXTRACT(EPOCH FROM current_timestamp - ctct_draft_saved_at )/3600 as hours_since_last_email FROM \"#{CKAN_INSTITUTE_MESSAGES_RESOURCE_ID}\" ORDER BY ctct_draft_saved_at asc limit 1"
		  	last_email_sent_result = sql_search_ckan(last_email_sent_sql)
		  	if last_email_sent_result.first["hours_since_last_email"] > 4
		  		# if the last email communication was more than four hours ago, send an alert about the latest observation

			  	message_introduction = "This is an air quality notification from the Institute for Healthy Air, Water, and Soil."
					message_html = <<-EOS
						<!DOCTYPE html>
						<html>
						<head>
						<meta content="width=device-width" name="viewport">
						<!-- major credit goes to https://github.com/leemunroe/html-email-template for the HTML email template -->
						<title>Email from the Institute for Healthy Air, Water, and Soil</title>
						<style>
							*{margin:0;padding:0;font-family:"Helvetica Neue",Helvetica,Helvetica,Arial,sans-serif;font-size:100%;line-height:1.6}img{max-width:100%}body{-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:none;width:100%!important;height:100%}a{color:#348eda}.btn-primary{text-decoration:none;color:#FFF;background-color:#348eda;border:solid #348eda;border-width:10px 20px;line-height:2;font-weight:700;margin-right:10px;text-align:center;cursor:pointer;display:inline-block;border-radius:25px}.btn-secondary{text-decoration:none;color:#FFF;background-color:#aaa;border:solid #aaa;border-width:10px 20px;line-height:2;font-weight:700;margin-right:10px;text-align:center;cursor:pointer;display:inline-block;border-radius:25px}.last{margin-bottom:0}.first{margin-top:0}.padding{padding:10px 0}table.body-wrap{width:100%;padding:20px}table.body-wrap .container{border:1px solid #f0f0f0}table.footer-wrap{width:100%;clear:both!important}.footer-wrap .container p{font-size:12px;color:#666}table.footer-wrap a{color:#999}h1,h2,h3{font-family:"Helvetica Neue",Helvetica,Arial,"Lucida Grande",sans-serif;color:#000;margin:40px 0 10px;line-height:1.2;font-weight:200}h1{font-size:36px}h2{font-size:28px}h3{font-size:22px}ol,p,ul{margin-bottom:10px;font-weight:400;font-size:14px}ol li,ul li{margin-left:5px;list-style-position:inside}.container{display:block!important;max-width:600px!important;margin:0 auto!important;clear:both!important}.body-wrap .container{padding:20px}.content{max-width:600px;margin:0 auto;display:block}.content table{width:100%}
							table[width="595"] {width: 300px !important;}
						</style>
						</head><body bgcolor="#F6F6F6"><table class="body-wrap"><tr><td></td><td class="container" style="background-color: #FFFFFF"><div class="content"><table><tr><td>
							<p><Greeting /></p>
							<p>#{message_introduction}</p>
							<h1>Latest Observations</h1>
							#{format_observations_html(observations)}
						<br /><table><tr><td class="padding">
						</td></tr></table><p>
						<br /></p>
							<p>Have a happy and healthy day,</p>
							<p> The Institute for Healthy Air, Water, and Soil
							<br /><a href="mailto:louisville@instituteforhealthyairwaterandsoil.org">louisville@instituteforhealthyairwaterandsoil.org</a>
							<br />Follow us on <a href= "http://twitter.com/healthyaws">Twitter</a> and <a href="http://facebook.com/Instituteforhealthyairwaterandsoil">Facebook</a></p>
						</p>
							<p><em>Together let's preserve our World's Sacred Air, Water, and Soil, so as tocreate the healthy communities that are essential for the survival of all of life!</em></p>
						</td></tr></table></div></td><td></td></tr></table></body></html>
					EOS

					message_text = <<-EOS
			.

			<Greeting />

			#{message_introduction}

			## Latest Observations ##
			#{format_observations_text(observations)}

			Have a happy and healthy day,</p>

			The Institute for Healthy Air, Water, and Soil
			louisville@instituteforhealthyairwaterandsoil.org
			Follow us on Twitter (http://twitter.com/healthyaws) and
			  Facebook (http://facebook.com/Instituteforhealthyairwaterandsoil)

			Together let's preserve our World's Sacred Air, Water, and Soil, so as to
			create the healthy communities that are essential for the survival of all of life!


			EOS

					puts message_text
					puts message_html

					# Now that we've got the HTML and text versions of the email crafted, it's time to make API calls to Constant Contact
					time_sent = Time.now.utc.iso8601
					create_campaign_data = {
						"name" => "Breaking Air Quality Email - #{time_sent}",
						"subject" => "AIR QUALITY NOTIFICATION from the Institute for Healthy Air, Water, and Soil",
						"sent_to_contact_lists" => [{"id" => CTCT_LIST_ID}],
						"from_name" => "Institute for Healthy Air, Water, and Soil",
						"from_email" => "louisville@instituteforhealthyairwaterandsoil.org",
						"reply_to_email" => "louisville@instituteforhealthyairwaterandsoil.org",
						"is_permission_reminder_enabled" => false,
						"is_view_as_webpage_enabled" => false,
						"greeting_salutations" => "Hi",
						"greeting_name" => "FIRST_NAME",
						"greeting_string" => "Hi",
						"email_content" => message_html,
						"text_content" => message_text,
						"email_content_format" => "HTML",
						"style_sheet" => "",
						"message_footer" => {
							"organization_name" => "Institute for Healthy Air, Water, and Soil",
							"address_line_1" => "Waterfront Plaza, West Tower",
							"address_line_2" => "11th Floor 325 W. Main Street",
							"address_line_3" => "Suite 1110",
							"city" => "Louisville",
							"state" => "KY",
							"international_state" => "",
							"postal_code" => "40202",
							"country" => "US",
							"include_forward_email" => true,
							"forward_email_link_text" => "Click here to forward this message",
							"include_subscribe_link" => true,
							"subscribe_link_text" => "Subscribe!"
						}
					}

					create_campaign_response = RestClient.post("https://api.constantcontact.com/v2/emailmarketing/campaigns?api_key=#{ENV['CONSTANTCONTACT_API_KEY']}", create_campaign_data.to_json, :content_type => :json, :accept => :json, 'Authorization' => "Bearer #{ENV['CONSTANTCONTACT_ACCESS_TOKEN']}")
					if create_campaign_response.code == 201
						create_campaign_result = JSON.parse(create_campaign_response)
						campaign_id = create_campaign_result["id"]

						schedule_campaign_response = RestClient.post("https://api.constantcontact.com/v2/emailmarketing/campaigns/#{campaign_id}/schedules?api_key=#{ENV['CONSTANTCONTACT_API_KEY']}", {}.to_json, :content_type => :json, :accept => :json, 'Authorization' => "Bearer #{ENV['CONSTANTCONTACT_ACCESS_TOKEN']}")
						if schedule_campaign_response.code == 201

							data_to_record = {
								:ctct_id => campaign_id.to_s,
								:ctct_list_id => CTCT_LIST_ID.to_s,
								:ctct_draft_saved_at => time_sent,
								:message_type => "breaking",
								:message_html => create_campaign_data["email_content"],
								:message_text => create_campaign_data["text_content"],
								:highest_observation_at => highest_observation["observation_at"].iso8601,
								:highest_observation_aqi => highest_observation["AQI"],
								:highest_observation_aqi_cat => highest_observation["Category"]["Name"],
								:highest_observation_aqi_param => highest_observation["Category"]["Name"]
							}

							upload_data_to_ckan_resource(CKAN_INSTITUTE_MESSAGES_RESOURCE_ID, [data_to_record], 'upsert')
							puts "Campaign scheduled and logged! It will go out in about 5 minutes"
						else
							raise StandardError, "Campaign ##{campaign_id} could not be scheduled"
						end

					else
						raise StandardError, "Campaign could not be created"
					end

				end


		  end


  	end

  	task :daily do
			# First, let's get the forecast from AirNow APIs
		  forecasts_url = "http://www.airnowapi.org/aq/forecast/latLong/?format=application/json&latitude=#{ENV['FOCUS_CITY_LAT']}&longitude=#{ENV['FOCUS_CITY_LON']}&distance=25&API_KEY=#{ENV["AIRNOW_API_KEY"]}"
		  forecasts_data = JSON.parse(RestClient.get(forecasts_url))
		  forecasts = forecasts_data.map do |result|
		    result["aqi_cat"] = category_number_to_category(result["Category"]["Number"])
		    result
		  end

		  # Create two arrays of forecasts (one for today and tomorrow) sorted descending by AQI
		  todays_forecasts = forecasts.select{|x| x["DateForecast"].strip == Date.today.strftime("%Y-%m-%d")}.sort_by{|x| -x["AQI"]}
		  tomorrows_forecasts = forecasts.select{|x| x["DateForecast"].strip == (Date.today+1).strftime("%Y-%m-%d")}.sort_by{|x| -x["AQI"]}

		  # See if today or tomorrow are action days
		  today_is_an_action_day = todays_forecasts.select{|x| x["ActionDay"] == true}.count > 1
		  tomorrow_is_an_action_day = tomorrows_forecasts.select{|x| x["ActionDay"] == true}.count > 1

		  # Count the number of AQEs that have been deployed by the Institute
		  egg_ids = META["aqe"]["extras_hash"]["Focus IDs"]
		  n_eggs = egg_ids.split(",").count
		  eggs_last_updated_sql = "SELECT site_table.id, (SELECT EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - data_table.datetime)) FROM \"7d618c44-1098-4348-9f57-8d32d4b159b6\" data_table WHERE data_table.feed_id = site_table. ID ORDER BY datetime DESC LIMIT 1	) AS last_updated_seconds_ago FROM \"7c0608e3-fb4d-4fb3-928c-5351e5b9b122\" site_table WHERE site_table.id IN (#{META["aqe"]["extras_hash"]["Focus IDs"]})"
		  eggs_last_updated_result = sql_search_ckan(eggs_last_updated_sql)
		  eggs_last_updated_within_a_week = eggs_last_updated_result.select{|e| e["last_updated_seconds_ago"] != nil && e["last_updated_seconds_ago"] < 7*24*60*60}
		  n_eggs_last_updated_within_a_week = eggs_last_updated_within_a_week.count
		  egg_message = "The Institute is in the process of deploying Air Quality Eggs. To date, #{n_eggs} have been deployed and #{n_eggs_last_updated_within_a_week} have sent us data in the past 7 days. You can explore the data they collect alongside other community data at http://LouisvilleAirMap.com"

		  message_introduction = "This is your daily air quality update from the Institute for Healthy Air, Water, and Soil."
			message_html = <<-EOS
				<!DOCTYPE html>
				<html>
				<head>
				<meta content="width=device-width" name="viewport">
				<!-- major credit goes to https://github.com/leemunroe/html-email-template for the HTML email template -->
				<title>Email from the Institute for Healthy Air, Water, and Soil</title>
				<style>
					*{margin:0;padding:0;font-family:"Helvetica Neue",Helvetica,Helvetica,Arial,sans-serif;font-size:100%;line-height:1.6}img{max-width:100%}body{-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:none;width:100%!important;height:100%}a{color:#348eda}.btn-primary{text-decoration:none;color:#FFF;background-color:#348eda;border:solid #348eda;border-width:10px 20px;line-height:2;font-weight:700;margin-right:10px;text-align:center;cursor:pointer;display:inline-block;border-radius:25px}.btn-secondary{text-decoration:none;color:#FFF;background-color:#aaa;border:solid #aaa;border-width:10px 20px;line-height:2;font-weight:700;margin-right:10px;text-align:center;cursor:pointer;display:inline-block;border-radius:25px}.last{margin-bottom:0}.first{margin-top:0}.padding{padding:10px 0}table.body-wrap{width:100%;padding:20px}table.body-wrap .container{border:1px solid #f0f0f0}table.footer-wrap{width:100%;clear:both!important}.footer-wrap .container p{font-size:12px;color:#666}table.footer-wrap a{color:#999}h1,h2,h3{font-family:"Helvetica Neue",Helvetica,Arial,"Lucida Grande",sans-serif;color:#000;margin:40px 0 10px;line-height:1.2;font-weight:200}h1{font-size:36px}h2{font-size:28px}h3{font-size:22px}ol,p,ul{margin-bottom:10px;font-weight:400;font-size:14px}ol li,ul li{margin-left:5px;list-style-position:inside}.container{display:block!important;max-width:600px!important;margin:0 auto!important;clear:both!important}.body-wrap .container{padding:20px}.content{max-width:600px;margin:0 auto;display:block}.content table{width:100%}
					table[width="595"] {width: 300px !important;}
				</style>
				</head><body bgcolor="#F6F6F6"><table class="body-wrap"><tr><td></td><td class="container" style="background-color: #FFFFFF"><div class="content"><table><tr><td>
					<p><Greeting /></p>
					<p>#{message_introduction}</p>
					<h1>Today's Forecast</h1>
					#{format_action_day_html(today_is_an_action_day)}
					#{format_forecasts_html(todays_forecasts)}
					<h2>Tomorrow's Forecast</h2>
					#{format_action_day_html(tomorrow_is_an_action_day)}
					#{format_forecasts_html(tomorrows_forecasts)}
				<br /><table><tr><td class="padding">
					<!-- <p style="text-align:center;"><a class="btn-primary" href= "http://louisvilleairmap.com">LouisvilleAirMap.com</a></p> -->
				</td></tr></table><p>
					#{egg_message}<br />
				<br /></p>
					<p>Have a happy and healthy day,</p>
					<p> The Institute for Healthy Air, Water, and Soil
					<br /><a href="mailto:louisville@instituteforhealthyairwaterandsoil.org">louisville@instituteforhealthyairwaterandsoil.org</a>
					<br />Follow us on <a href= "http://twitter.com/healthyaws">Twitter</a> and <a href="http://facebook.com/Instituteforhealthyairwaterandsoil">Facebook</a></p>
				</p>
					<p><em>Together let's preserve our World's Sacred Air, Water, and Soil, so as tocreate the healthy communities that are essential for the survival of all of life!</em></p>
				</td></tr></table></div></td><td></td></tr></table></body></html>
			EOS

			message_text = <<-EOS
	.

	<Greeting />

	#{message_introduction}

	## Today's Forecast ##
	#{format_action_day_text(today_is_an_action_day)}#{format_forecasts_text(todays_forecasts)}
	## Tomorrow's Forecast ##
	#{format_action_day_text(today_is_an_action_day)}#{format_forecasts_text(tomorrows_forecasts)}
	#{egg_message}

	Have a happy and healthy day,</p>

	The Institute for Healthy Air, Water, and Soil
	louisville@instituteforhealthyairwaterandsoil.org
	Follow us on Twitter (http://twitter.com/healthyaws) and
	  Facebook (http://facebook.com/Instituteforhealthyairwaterandsoil)

	Together let's preserve our World's Sacred Air, Water, and Soil, so as to
	create the healthy communities that are essential for the survival of all of life!


	EOS

			puts message_text
			puts message_html

			# Now that we've got the HTML and text versions of the email crafted, it's time to make API calls to Constant Contact
			time_sent = Time.now.utc.iso8601
			create_campaign_data = {
				"name" => "Daily Air Quality Email - #{time_sent}",
				"subject" => "#{Date.today.strftime("%m/%d/%Y")} Air Quality Update from the Institute for Healthy Air, Water, and Soil",
				"sent_to_contact_lists" => [{"id" => CTCT_LIST_ID}],
				"from_name" => "Institute for Healthy Air, Water, and Soil",
				"from_email" => "louisville@instituteforhealthyairwaterandsoil.org",
				"reply_to_email" => "louisville@instituteforhealthyairwaterandsoil.org",
				"is_permission_reminder_enabled" => false,
				"is_view_as_webpage_enabled" => false,
				"greeting_salutations" => "Hi",
				"greeting_name" => "FIRST_NAME",
				"greeting_string" => "Hi",
				"email_content" => message_html,
				"text_content" => message_text,
				"email_content_format" => "HTML",
				"style_sheet" => "",
				"message_footer" => {
					"organization_name" => "Institute for Healthy Air, Water, and Soil",
					"address_line_1" => "Waterfront Plaza, West Tower",
					"address_line_2" => "11th Floor 325 W. Main Street",
					"address_line_3" => "Suite 1110",
					"city" => "Louisville",
					"state" => "KY",
					"international_state" => "",
					"postal_code" => "40202",
					"country" => "US",
					"include_forward_email" => true,
					"forward_email_link_text" => "Click here to forward this message",
					"include_subscribe_link" => true,
					"subscribe_link_text" => "Subscribe!"
				}
			}

			create_campaign_response = RestClient.post("https://api.constantcontact.com/v2/emailmarketing/campaigns?api_key=#{ENV['CONSTANTCONTACT_API_KEY']}", create_campaign_data.to_json, :content_type => :json, :accept => :json, 'Authorization' => "Bearer #{ENV['CONSTANTCONTACT_ACCESS_TOKEN']}")
			if create_campaign_response.code == 201
				create_campaign_result = JSON.parse(create_campaign_response)
				campaign_id = create_campaign_result["id"]

				schedule_campaign_response = RestClient.post("https://api.constantcontact.com/v2/emailmarketing/campaigns/#{campaign_id}/schedules?api_key=#{ENV['CONSTANTCONTACT_API_KEY']}", {}.to_json, :content_type => :json, :accept => :json, 'Authorization' => "Bearer #{ENV['CONSTANTCONTACT_ACCESS_TOKEN']}")
				if schedule_campaign_response.code == 201

					data_to_record = {
						:ctct_id => campaign_id.to_s,
						:ctct_list_id => CTCT_LIST_ID.to_s,
						:ctct_draft_saved_at => time_sent,
						:message_type => "daily",
						:message_html => create_campaign_data["email_content"],
						:message_text => create_campaign_data["text_content"],
						:today_action_day => (today_is_an_action_day ? 1 : 0),
						:tomorrow_action_day => (tomorrow_is_an_action_day ? 1 : 0),
						:institute_live_eggs => n_eggs_last_updated_within_a_week,
						:institute_total_eggs => n_eggs
					}
					unless todays_forecasts.empty?
						data_to_record[:today_forecast_prevailing_aqi] = todays_forecasts.first["AQI"]
						data_to_record[:today_forecast_prevailing_aqi_cat] = todays_forecasts.first["Category"]["Name"]
						data_to_record[:today_forecast_prevailing_aqi_param] = todays_forecasts.first["ParameterName"]
					end
					unless tomorrows_forecasts.empty?
						data_to_record[:tomorrow_forecast_prevailing_aqi] = tomorrows_forecasts.first["AQI"]
						data_to_record[:tomorrow_forecast_prevailing_aqi_cat] = tomorrows_forecasts.first["Category"]["Name"]
						data_to_record[:tomorrow_forecast_prevailing_aqi_param] = tomorrows_forecasts.first["ParameterName"]
					end

					upload_data_to_ckan_resource(CKAN_INSTITUTE_MESSAGES_RESOURCE_ID, [data_to_record], 'upsert')
					puts "Campaign scheduled and logged! It will go out in about 5 minutes"
				else
					raise StandardError, "Campaign ##{campaign_id} could not be scheduled"
				end

			else
				raise StandardError, "Campaign could not be created"
			end

			puts "\nSend daily AQS rake task complete."

	  end

	end

end