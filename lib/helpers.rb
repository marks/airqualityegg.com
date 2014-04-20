module AppHelpers

  def string_to_time(timestamp)
    Time.parse(timestamp).strftime("%d %b %Y %H:%M:%S")
    rescue
    ''
  end

  def celsius_to_fahrenheit(value)
    value.to_f * 9 / 5 + 32
  end

  def determine_aqi_range(parameter,value,unit)
    case parameter
    when "OZONE-8HR"
      value = value/1000.00 if unit.upcase == "PPB"
      value = value.round(3)
      if value.between?(0,0.064)
        return [0,50]
      elsif value.between?(0.065,0.084)
        return [51,100]
      elsif value.between?(0.085,0.104)
        return [101,150]
      elsif value.between?(0.105,0.124)
        return [151,200]
      elsif value.between?(0.125,0.374)
        return [201,300]
      elsif value >= 0.375
        return [301,500]
      end
    when "OZONE-1HR"
      value = value/1000.00 if unit.upcase == "PPB"
      value = value.round(3)
      if value.between?(0,0.124)
        return [0,100]
      elsif value.between?(0.125,0.164)
        return [101,150]
      elsif value.between?(0.165,0.204)
        return [151,200]
      elsif value.between?(0.205,0.404)
        return [201,300]
      elsif value.between?(0.405,0.504)
        return [301,400]
      elsif value >= 0.505
        return [401,500]
      end
    when "PM2.5"
      vaule = value.round(1)
      if value.between?(0,15.4)
        return [0,51]
      elsif value.between?(15.5,40.4)
        return [51,100]
      elsif value.between?(40.5,65.4)
        return [101,150]
      elsif value.between?(65.5,150.4)
        return [151,200]
      elsif value.between?(150.5,250.4)
        return [201,300]
      elsif value.between?(250.5,350.4)
        return [301,400]
      elsif value >= 350.5
        return [401,500]
      end
    when "CO"
      value = value/1000.00 if unit.upcase == "PPB"
      value = value.round(3)
      if value.between?(0,4.4)
        return [0,50]
      elsif value.between?(4.5,9.4)
        return [51,100]
      elsif value.between?(9.5,12.4)
        return [101,150]
      elsif value.between?(12.5,15.4)
        return [151,200]
      elsif value.between?(15.5,30.4)
        return [201,300]
      elsif value.between?(30.5,40.4)
        return [301,400]
      elsif value >= 40.5
        return [401,500]
      end
    when "NO2"
      value = value/1000.00 if unit.upcase == "PPB"
      value = value.round(3)
      if value.between?(0.65,1.24)
        return [201,300]
      elsif value.between?(1.25,1.64)
        return [301,400]
      elsif value >= 1.65
        return [401,500]
      end
    else
      return nil
    end 


  end

end

