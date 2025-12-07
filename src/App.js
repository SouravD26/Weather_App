import React, { useState } from "react";
import "./App.css";
import Swal from "sweetalert2";

const API_KEY = "50b600f19a27c28db981ecbc9fdc12fa";

export default function App() {
  const [city, setCity] = useState("");
  // Default to sunny background and animation
  const [weather, setWeather] = useState({
    name: "",
    temp: "",
    desc: "clear sky",
    humidity: "",
    wind: "",
    clouds: "",
  });
  const [loading, setLoading] = useState(false);
  const [extra, setExtra] = useState({
    aqi: null,
    uv: null,
    pressure: null,
    visibility: null,
    windDir: null,
    sunHours: null,
  });

  const getWeather = async (cityName) => {
    const searchCity = cityName || city;
    if (!searchCity.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Please enter a city name!",
        confirmButtonColor: "#3085d6",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
          searchCity
        )}&appid=${API_KEY}&units=metric`
      );
      const data = await res.json();

      if (data.cod === 200) {
        setWeather({
          name: data.name,
          temp: Math.round(data.main.temp),
          desc: data.weather[0].description,
          humidity: data.main.humidity,
          wind: data.wind.speed,
          clouds: data.clouds.all,
        });

        // Fetch AQI and UV index using lat/lon
        const lat = data.coord.lat;
        const lon = data.coord.lon;

        // AQI
        let aqi = null;
        try {
          const aqiRes = await fetch(
            `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`
          );
          const aqiData = await aqiRes.json();
          aqi =
            aqiData.list && aqiData.list[0] ? aqiData.list[0].main.aqi : null;
        } catch {}

        // UV Index
        let uv = null;
        try {
          const uvRes = await fetch(
            `https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${API_KEY}`
          );
          const uvData = await uvRes.json();
          uv = uvData.value;
        } catch {}

        // Sun hours (approximate: sunset-sunrise in hours)
        let sunHours = null;
        if (data.sys && data.sys.sunrise && data.sys.sunset) {
          sunHours = ((data.sys.sunset - data.sys.sunrise) / 3600).toFixed(1);
        }

        setExtra({
          aqi,
          uv,
          pressure: data.main.pressure,
          visibility: data.visibility,
          windDir: data.wind.deg,
          sunHours,
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "City not found!",
          text: "Please check the city name and try again.",
          confirmButtonColor: "#3085d6",
        });
        setExtra({
          aqi: null,
          uv: null,
          pressure: null,
          visibility: null,
          windDir: null,
          sunHours: null,
        });
      }
    } catch {
      alert("Error fetching weather!");
      setExtra({
        aqi: null,
        uv: null,
        pressure: null,
        visibility: null,
        windDir: null,
        sunHours: null,
      });
    }
    setLoading(false);
  };

  // const getBackgroundClass = () => {
  //   if (!weather) return "default-bg";
  //   const desc = weather.desc.toLowerCase();
  //   if (desc.includes("cloud")) return "cloudy-bg";
  //   if (desc.includes("rain")) return "rainy-bg";
  //   if (desc.includes("snow")) return "snowy-bg";
  //   if (desc.includes("clear")) return "sunny-bg";
  //   if (desc.includes("thunder") || desc.includes("storm")) return "thunder-bg";
  //   return "default-bg";
  // };

  const formatDate = () => {
    const now = new Date();
    return now.toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Inline background image style logic
  const getBackgroundImage = () => {
    if (!weather || !weather.desc)
      return `${process.env.PUBLIC_URL}/images/sunny.mp4`;
    const desc = weather.desc.toLowerCase();
    if (desc.includes("cloud"))
      return `${process.env.PUBLIC_URL}/images/cloudy.gif`;
    if (desc.includes("rain"))
      return `${process.env.PUBLIC_URL}/images/rain.gif`;
    if (desc.includes("snow"))
      return `${process.env.PUBLIC_URL}/images/snow.gif`;
    if (desc.includes("clear"))
      return `${process.env.PUBLIC_URL}/images/sunny.gif`;
    if (desc.includes("thunder") || desc.includes("storm"))
      return `${process.env.PUBLIC_URL}/images/thunder.gif`;
    return `${process.env.PUBLIC_URL}/images/sunny.gif`;
  };

  // Animation overlay class based on weather
  const getAnimationClass = () => {
    if (!weather || !weather.desc) return "sunny-anim";
    const desc = weather.desc.toLowerCase();
    if (desc.includes("cloud")) return "cloudy-anim";
    if (desc.includes("rain")) return "rainy-anim";
    if (desc.includes("snow")) return "snowy-anim";
    if (desc.includes("clear")) return "sunny-anim";
    if (desc.includes("thunder") || desc.includes("storm"))
      return "thunder-anim";
    return "sunny-anim";
  };

  return (
    <div
      className="app-container"
      style={{
        backgroundImage: `url('${getBackgroundImage()}')`,
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      }}
    >
      {/* Weather Animation Overlay */}
      <div className={`weather-animation ${getAnimationClass()}`}></div>

      <div className="weather-card glass">
        <div className="search-box">
          <input
            type="text"
            placeholder="Enter city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && getWeather()}
          />
          <button onClick={() => getWeather()} className="search-btn">
            🔍
          </button>
        </div>

        {loading && <p className="loading">Loading...</p>}

        {weather && weather.temp !== "" ? (
          <>
            <h1 className="temp">{weather.temp}°C</h1>
            <h2 className="city">{weather.name}</h2>
            <p className="date">{formatDate()}</p>
            <p className="desc">{weather.desc}</p>
            <div className="details">
              <p>Clouds: {weather.clouds}%</p>
              <p>Humidity: {weather.humidity}%</p>
              <p>Wind: {weather.wind} km/h</p>
              <p>
                Wind Direction:{" "}
                {extra.windDir !== null ? `${extra.windDir}°` : "-"}
              </p>
              <p>
                Pressure:{" "}
                {extra.pressure !== null ? `${extra.pressure} hPa` : "-"}
              </p>
              <p>
                Visibility:{" "}
                {extra.visibility !== null
                  ? `${(extra.visibility / 1000).toFixed(1)} km`
                  : "-"}
              </p>
              <p>UV Index: {extra.uv !== null ? extra.uv : "-"}</p>
              <p>AQI: {extra.aqi !== null ? extra.aqi : "-"}</p>
              <p>Sun Hours: {extra.sunHours !== null ? extra.sunHours : "-"}</p>
            </div>
          </>
        ) : (
          <h2 className="placeholder">Search for a city...</h2>
        )}
      </div>
    </div>
  );
}
