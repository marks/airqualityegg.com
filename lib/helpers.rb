module AppHelpers

  def string_to_time(timestamp)
    Time.parse(timestamp).strftime("%d %b %Y %H:%M:%S")
    rescue
    ''
  end

  def celsius_to_fahrenheit(value)
    value.to_f * 9 / 5 + 32
  end

end

