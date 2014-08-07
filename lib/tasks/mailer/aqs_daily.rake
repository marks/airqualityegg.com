namespace :ckan do 

  namespace :aqs_daily do

    task :send do 

	    # ** NOTES **
			# Create an email campaign (http://developer.constantcontact.com/docs/email-campaigns/email-campaigns-collection.html?method=POST)
			# POST https://api.constantcontact.com/v2/emailmarketing/campaigns?api_key=CONSTANTCONTACT_API_KEY
			# Headers:
			# Authorization: Bearer CONSTANTCONTACT_ACCESS_TOKEN
			# Content-Type: application/json
			# Body:
			# {
			# "name": "SHI DEV - Test Campaign 4",
			# "subject": "Subject Test",
			# "sent_to_contact_lists": [{"id": "CONSTANTCONTACT_LIST_ID"}],
			# "from_name": "Institute for Healthy Air, Water, and Soil",
			# "from_email": "louisville@instituteforhealthyairwaterandsoil.org",
			# "reply_to_email": "louisville@instituteforhealthyairwaterandsoil.org",
			# "is_permission_reminder_enabled": true,
			# "permission_reminder_text": "You're receiving this email because you have expressed an interest in the Institute for Healthy Air, Water, and Soil.",
			# "is_view_as_webpage_enabled": true,
			# "view_as_web_page_text": "To view this message as a web page,",
			# "view_as_web_page_link_text": "click here",
			# "greeting_salutations": "Hi",
			# "greeting_name": "FIRST_NAME",
			# "greeting_string": "Hi",
			# "email_content": "<html><body><p><strong>This</strong> is text of the email message.</p></body></html>",
			# "text_content": "This is the text-only content of the email message for mail clients that do not support HTML.",
			# "email_content_format": "HTML",
			# "style_sheet": "",
			# "message_footer": {
			# "organization_name": "Institute for Healthy Air, Water, and Soil",
			# "address_line_1": "Waterfront Plaza, West Tower",
			# "address_line_2": "11th Floor 325 W. Main Street",
			# "address_line_3": "Suite 1110",
			# "city": "Louisville",
			# "state": "KY",
			# "international_state": "",
			# "postal_code": "40202",
			# "country": "US",
			# "include_forward_email": true,
			# "forward_email_link_text": "Click here to forward this message",
			# "include_subscribe_link": true,
			# "subscribe_link_text": "Subscribe!"
			# }
			# }
			# Returns
			# Status code 201 on success
			# JSON response includes root value "id" which is needed for campaign updating and transmission
			# Example: 1118115956108
			# Schedule the email campaign (http://developer.constantcontact.com/docs/campaign-scheduling/campaign-schedule-collection.html?method=POST)
			# POST https://api.constantcontact.com/v2/emailmarketing/campaigns/XYZ/schedules?api_key=CONSTANTCONTACT_API_KEY
			# Headers:
			# Authorization: Bearer CONSTANTCONTACT_ACCESS_TOKEN
			# Content-Type: application/json
			# Body:
			# { "scheduled_date": "2014-08-04T14:00:00-04:00" }
			# Returns
			# Status code 201 on success


			# ** EMAIL TEMPLATE **
			# <!DOCTYPE html>
			# <html>
			# <head>
			# <meta content="width=device-width" name="viewport">
			# <!-- major credit goes to https://github.com/leemunroe/html-email-template -->
			# <title>Newsletter from the Institute for Healthy Air, Water, and Soil</title>
			# <style>*{margin:0;padding:0;font-family:"Helvetica Neue",Helvetica,Helvetica,Arial,sans-serif;font-size:100%;line-height:1.6}img{max-width:100%}body{-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:none;width:100%!important;height:100%}a{color:#348eda}.btn-primary{text-decoration:none;color:#FFF;background-color:#348eda;border:solid #348eda;border-width:10px 20px;line-height:2;font-weight:700;margin-right:10px;text-align:center;cursor:pointer;display:inline-block;border-radius:25px}.btn-secondary{text-decoration:none;color:#FFF;background-color:#aaa;border:solid #aaa;border-width:10px 20px;line-height:2;font-weight:700;margin-right:10px;text-align:center;cursor:pointer;display:inline-block;border-radius:25px}.last{margin-bottom:0}.first{margin-top:0}.padding{padding:10px 0}table.body-wrap{width:100%;padding:20px}table.body-wrap .container{border:1px solid #f0f0f0}table.footer-wrap{width:100%;clear:both!important}.footer-wrap .container p{font-size:12px;color:#666}table.footer-wrap a{color:#999}h1,h2,h3{font-family:"Helvetica Neue",Helvetica,Arial,"Lucida Grande",sans-serif;color:#000;margin:40px 0 10px;line-height:1.2;font-weight:200}h1{font-size:36px}h2{font-size:28px}h3{font-size:22px}ol,p,ul{margin-bottom:10px;font-weight:400;font-size:14px}ol li,ul li{margin-left:5px;list-style-position:inside}.container{display:block!important;max-width:600px!important;margin:0 auto!important;/ makes it centered / clear:both!important}.body-wrap .container{padding:20px}.content{max-width:600px;margin:0 auto;display:block}.content table{width:100%}</style>
			# </head>
			# <body bgcolor="#F6F6F6">
			# <table class="body-wrap">
			# <tr>
			# <td></td>
			# <td class="container" style="background-color: #FFFFFF">
			# <div class="content">
			# <table>
			# <tr>
			# <td>
			# <p><Greeting /></p>
			# <p>This is your daily air quality update from the Institute for Healthy Air, Water, and Soil.</p>
			# <h1>Today's Forecast</h1>
			# <p></p>
			# <h2>Tomorrow and beyond</h2>
			# <p></p>
			# <br />
			# <table>
			# <tr>
			# <td class="padding">
			# <p style="text-align:center;"><a class="btn-primary" href= "http://louisvilleairmap.com">
			# Visit LouisvilleAirMap.com for more information</a></p>
			# </td>
			# </tr>
			# </table>
			# <br />
			# <p>Have a happy and healthy day,</p>
			# <p> The Institute for Healthy Air, Water, and Soil
			# <br /><a href="mailto:louisville@instituteforhealthyairwaterandsoil.org">louisville@instituteforhealthyairwaterandsoil.org</a>
			# <br />Follow us on <a href= "http://twitter.com/healthyaws">Twitter</a> and <a href="http://facebook.com/Instituteforhealthyairwaterandsoil">Facebook</a></p>
			# </p>
			# <p><em>Together let's preserve our World's Sacred Air, Water, and Soil, so as to create the healthy communities that are essential for the survival of all of life!</em></p>
			# </td>
			# </tr>
			# </table>
			# </div>
			# </td>
			# <td></td>
			# </tr>
			# </table>
			# </body>
			# </html>


    end

	end

end