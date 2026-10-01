import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import Swal from "sweetalert2";
import { playWeatherSound, stopWeatherSound } from "./sound";

const API_KEY = "50b600f19a27c28db981ecbc9fdc12fa";

const EMPTY_EXTRA = {
  aqi: null,
  uv: null,
  pressure: null,
  visibility: null,
  windDir: null,
  sunrise: null,
  sunset: null,
  feelsLike: null,
  tempMin: null,
  tempMax: null,
};

const AQI_LABELS = ["", "Good", "Fair", "Moderate", "Poor", "Very Poor"];

const ICONS = {
  clear: { day: "☀️", night: "🌙" },
  clouds: { day: "⛅", night: "☁️" },
  rain: { day: "🌧️", night: "🌧️" },
  thunder: { day: "⛈️", night: "⛈️" },
  snow: { day: "❄️", night: "❄️" },
  mist: { day: "🌫️", night: "🌫️" },
};

// Map OpenWeather's main condition to one of our scenes
const getCondition = (main = "") => {
  const m = main.toLowerCase();
  if (m === "thunderstorm") return "thunder";
  if (m === "rain" || m === "drizzle") return "rain";
  if (m === "snow") return "snow";
  if (m === "clouds") return "clouds";
  if (m === "clear") return "clear";
  if (m) return "mist"; // mist, fog, haze, smoke, dust...
  return "clear";
};

const compass = (deg) =>
  ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];

const formatTime = (unix, offset) =>
  new Date((unix + offset) * 1000).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

// Group 3-hourly forecast into days (city local time): min/max + midday condition
const buildForecast = (list, offset) => {
  const days = {};
  list.forEach((item) => {
    const d = new Date((item.dt + offset) * 1000);
    const key = d.toISOString().slice(0, 10);
    const hour = d.getUTCHours();
    if (!days[key]) days[key] = { key, date: d, min: Infinity, max: -Infinity, pop: 0, pick: null, dist: 99 };
    const day = days[key];
    day.min = Math.min(day.min, item.main.temp_min);
    day.max = Math.max(day.max, item.main.temp_max);
    day.pop = Math.max(day.pop, item.pop || 0);
    if (Math.abs(hour - 13) < day.dist) {
      day.dist = Math.abs(hour - 13);
      day.pick = item.weather[0];
    }
  });
  return Object.values(days)
    .slice(0, 6)
    .map((d, i) => ({
      key: d.key,
      label:
        i === 0
          ? "Today"
          : d.date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      min: Math.round(d.min),
      max: Math.round(d.max),
      pop: Math.round(d.pop * 100),
      condition: getCondition(d.pick.main),
      desc: d.pick.description,
    }))
    .slice(0, 5);
};

const random = (min, max) => Math.random() * (max - min) + min;

const QUICK_CITIES = ["London", "Dubai", "Tokyo", "Mumbai", "Oslo", "New York"];

function useCountUp(target) {
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (typeof target !== "number") return;
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const t = Math.min((now - start) / 900, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value;
}

function Forecast({ days }) {
  const low = Math.min(...days.map((d) => d.min));
  const high = Math.max(...days.map((d) => d.max));
  const span = Math.max(high - low, 1);
  return (
    <section className="forecast">
      <h3>5-Day Forecast</h3>
      <ul>
        {days.map((d, i) => (
          <li
            key={d.key}
            style={{ animationDelay: `${0.5 + i * 0.08}s` }}
            title={d.desc}
          >
            <span className="f-day">{d.label}</span>
            <span className="f-icon">
              {ICONS[d.condition].day}
              {d.pop >= 20 && <small>{d.pop}%</small>}
            </span>
            <span className="f-min">{d.min}°</span>
            <span className="f-bar">
              <span
                style={{
                  left: `${((d.min - low) / span) * 100}%`,
                  right: `${100 - ((d.max - low) / span) * 100}%`,
                }}
              />
            </span>
            <span className="f-max">{d.max}°</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Cloud shape built from overlapping puffs; depth controls size, blur, speed
function Cloud({ depth, top, delay, dark }) {
  const scale = 0.5 + depth * 0.6;
  return (
    <div
      className={`cloud2 ${dark ? "dark" : ""}`}
      style={{
        top: `${top}%`,
        "--scale": scale,
        filter: `blur(${(1 - depth) * 4}px)`,
        opacity: 0.45 + depth * 0.5,
        animationDuration: `${90 - depth * 55}s`,
        animationDelay: `${delay}s`,
        zIndex: Math.round(depth * 10),
      }}
    >
      <span /><span /><span /><span />
    </div>
  );
}

function Scene({ condition, isNight, wind = 0 }) {
  const isWet = condition === "rain" || condition === "thunder";
  const tilt = Math.min(wind * 0.8, 25); // stronger wind -> more slanted rain

  const drops = useMemo(
    () =>
      Array.from({ length: isWet ? (condition === "thunder" ? 180 : 140) : 0 }, (_, i) => {
        const depth = Math.random();
        return {
          id: i,
          left: random(-10, 110),
          delay: random(0, 2),
          duration: 1.2 - depth * 0.7,
          height: 8 + depth * 22,
          width: depth > 0.7 ? 2 : 1,
          opacity: 0.25 + depth * 0.6,
        };
      }),
    [isWet, condition]
  );

  const splashes = useMemo(
    () =>
      Array.from({ length: isWet ? 25 : 0 }, (_, i) => ({
        id: i,
        left: random(0, 100),
        bottom: random(0, 12),
        delay: random(0, 2),
      })),
    [isWet]
  );

  const flakes = useMemo(
    () =>
      Array.from({ length: condition === "snow" ? 110 : 0 }, (_, i) => {
        const depth = Math.random();
        return {
          id: i,
          left: random(0, 100),
          delay: random(-15, 0),
          duration: 18 - depth * 10,
          size: 2 + depth * 7,
          blur: (1 - depth) * 2,
          sway: random(20, 70),
          opacity: 0.4 + depth * 0.6,
        };
      }),
    [condition]
  );

  const stars = useMemo(
    () =>
      Array.from({ length: 120 }, (_, i) => ({
        id: i,
        left: random(0, 100),
        top: random(0, 75),
        delay: random(0, 5),
        duration: random(2, 5),
        size: random(0.8, 2.8),
      })),
    []
  );

  const dust = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        left: random(0, 100),
        top: random(0, 100),
        size: random(2, 5),
        delay: random(-20, 0),
        duration: random(14, 26),
      })),
    []
  );

  const cloudCount =
    condition === "thunder" ? 9 : condition === "rain" ? 8 : condition === "clouds" ? 7 : condition === "snow" ? 4 : condition === "clear" ? 2 : 0;

  const clouds = useMemo(
    () =>
      Array.from({ length: cloudCount }, (_, i) => ({
        id: i,
        depth: i / Math.max(cloudCount - 1, 1),
        top: random(-4, 30),
        delay: -random(0, 80),
      })),
    [cloudCount]
  );

  const showStars = isNight && (condition === "clear" || condition === "clouds");

  return (
    <div className={`scene ${condition}`} aria-hidden="true">
      {/* Sky glow near the horizon */}
      <div className="horizon" />

      {showStars && (
        <>
          {stars.map((s) => (
            <span
              key={s.id}
              className="star"
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: s.size,
                height: s.size,
                animationDelay: `${s.delay}s`,
                animationDuration: `${s.duration}s`,
              }}
            />
          ))}
          <span className="shooting-star" />
          <span className="shooting-star s2" />
        </>
      )}

      {condition === "clear" && !isNight && (
        <>
          <div className="sun">
            <div className="sun-rays" />
          </div>
          <div className="god-rays" />
          <div className="flare f1" />
          <div className="flare f2" />
          <div className="flare f3" />
        </>
      )}
      {condition === "clear" && isNight && (
        <div className="moon">
          <span className="crater c1" />
          <span className="crater c2" />
          <span className="crater c3" />
        </div>
      )}

      {/* Floating light dust on calm weather */}
      {(condition === "clear" || condition === "clouds") &&
        dust.map((d) => (
          <span
            key={d.id}
            className="dust"
            style={{
              left: `${d.left}%`,
              top: `${d.top}%`,
              width: d.size,
              height: d.size,
              animationDelay: `${d.delay}s`,
              animationDuration: `${d.duration}s`,
            }}
          />
        ))}

      {clouds.map((c) => (
        <Cloud key={c.id} {...c} dark={isWet} />
      ))}

      {isWet && (
        <div className="rain-layer" style={{ "--tilt": `${tilt}deg` }}>
          {drops.map((p) => (
            <span
              key={p.id}
              className="drop"
              style={{
                left: `${p.left}%`,
                height: p.height,
                width: p.width,
                opacity: p.opacity,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
              }}
            />
          ))}
        </div>
      )}
      {isWet &&
        splashes.map((s) => (
          <span
            key={s.id}
            className="splash"
            style={{ left: `${s.left}%`, bottom: `${s.bottom}%`, animationDelay: `${s.delay}s` }}
          />
        ))}
      {isWet && <div className="rain-mist" />}

      {condition === "thunder" && (
        <>
          <div className="lightning" />
          <svg className="bolt b1" viewBox="0 0 60 300">
            <path d="M35 0 L15 120 L32 120 L10 300 L50 100 L30 100 L45 0 Z" />
          </svg>
          <svg className="bolt b2" viewBox="0 0 60 300">
            <path d="M30 0 L12 110 L28 110 L8 260 L46 95 L28 95 L40 0 Z" />
          </svg>
        </>
      )}

      {flakes.map((f) => (
        <span
          key={f.id}
          className="flake"
          style={{
            left: `${f.left}%`,
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            filter: `blur(${f.blur}px)`,
            "--sway": `${f.sway}px`,
            animationDelay: `${f.delay}s`,
            animationDuration: `${f.duration}s`,
          }}
        />
      ))}
      {condition === "snow" && <div className="snow-ground" />}

      {condition === "mist" && (
        <>
          <div className="fog fog-1" />
          <div className="fog fog-2" />
          <div className="fog fog-3" />
          <div className="fog fog-4" />
        </>
      )}

      {/* Subtle vignette for depth */}
      <div className="vignette" />
    </div>
  );
}


export default function App() {
  const [city, setCity] = useState("");
  const [weather, setWeather] = useState(null);
  const [extra, setExtra] = useState(EMPTY_EXTRA);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(false);

  const [soundOn, setSoundOn] = useState(true);
  const cardRef = useRef(null);
  const animatedTemp = useCountUp(weather ? weather.temp : null);

  const handleTilt = (e) => {
    const card = cardRef.current;
    if (!card || window.matchMedia("(hover: none)").matches) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.setProperty("--rx", `${-y * 6}deg`);
    card.style.setProperty("--ry", `${x * 6}deg`);
    card.style.setProperty("--mx", `${(x + 0.5) * 100}%`);
    card.style.setProperty("--my", `${(y + 0.5) * 100}%`);
  };

  const resetTilt = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
  };

  const getWeather = async (cityName) => {
    const query = (cityName || city).trim();
    if (!query) {
      Swal.fire({
        icon: "warning",
        title: "Please enter a city name!",
        confirmButtonColor: "#6366f1",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
          query
        )}&appid=${API_KEY}&units=metric`
      );
      const data = await res.json();

      if (data.cod !== 200) {
        Swal.fire({
          icon: "error",
          title: "City not found!",
          text: "Please check the city name and try again.",
          confirmButtonColor: "#6366f1",
        });
        setLoading(false);
        return;
      }

      const { lat, lon } = data.coord;
      const [aqi, uv, fc] = await Promise.all([
        fetch(
          `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`
        )
          .then((r) => r.json())
          .then((d) => (d.list && d.list[0] ? d.list[0].main.aqi : null))
          .catch(() => null),
        fetch(
          `https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${API_KEY}`
        )
          .then((r) => r.json())
          .then((d) => (d.value !== undefined ? d.value : null))
          .catch(() => null),
        fetch(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
        )
          .then((r) => r.json())
          .then((d) => buildForecast(d.list || [], data.timezone))
          .catch(() => []),
      ]);
      setForecast(fc);

      setWeather({
        name: data.name,
        country: data.sys.country,
        temp: Math.round(data.main.temp),
        desc: data.weather[0].description,
        condition: getCondition(data.weather[0].main),
        isNight: data.dt < data.sys.sunrise || data.dt > data.sys.sunset,
        humidity: data.main.humidity,
        wind: (data.wind.speed * 3.6).toFixed(1), // m/s -> km/h
        clouds: data.clouds.all,
        timezone: data.timezone,
        dt: data.dt,
      });
      setExtra({
        aqi,
        uv,
        pressure: data.main.pressure,
        visibility: data.visibility,
        windDir: data.wind.deg,
        sunrise: data.sys.sunrise,
        sunset: data.sys.sunset,
        feelsLike: Math.round(data.main.feels_like),
        tempMin: Math.round(data.main.temp_min),
        tempMax: Math.round(data.main.temp_max),
      });
    } catch {
      Swal.fire({
        icon: "error",
        title: "Error fetching weather!",
        confirmButtonColor: "#6366f1",
      });
    }
    setLoading(false);
  };

  const condition = weather ? weather.condition : "clear";
  const isNight = weather ? weather.isNight : false;

  // Play ambience matching the current weather
  useEffect(() => {
    if (weather && soundOn) playWeatherSound(condition, isNight);
    else stopWeatherSound();
    return stopWeatherSound;
  }, [weather, condition, isNight, soundOn]);

  const localDate = weather
    ? new Date((weather.dt + weather.timezone) * 1000).toLocaleString(
        "en-US",
        {
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
        }
      )
    : "";

  const stats = weather
    ? [
        { icon: "💧", label: "Humidity", value: `${weather.humidity}%` },
        {
          icon: "🌬️",
          label: "Wind",
          value: `${weather.wind} km/h${
            extra.windDir !== null && extra.windDir !== undefined
              ? ` ${compass(extra.windDir)}`
              : ""
          }`,
        },
        { icon: "☁️", label: "Clouds", value: `${weather.clouds}%` },
        {
          icon: "🧭",
          label: "Pressure",
          value: extra.pressure !== null ? `${extra.pressure} hPa` : "-",
        },
        {
          icon: "👁️",
          label: "Visibility",
          value:
            extra.visibility != null
              ? `${(extra.visibility / 1000).toFixed(1)} km`
              : "-",
        },
        {
          icon: "🔆",
          label: "UV Index",
          value: extra.uv !== null ? extra.uv.toFixed(1) : "-",
        },
        {
          icon: "🍃",
          label: "Air Quality",
          value: extra.aqi !== null ? AQI_LABELS[extra.aqi] : "-",
        },
        {
          icon: "🌅",
          label: "Sunrise",
          value: formatTime(extra.sunrise, weather.timezone),
        },
        {
          icon: "🌇",
          label: "Sunset",
          value: formatTime(extra.sunset, weather.timezone),
        },
      ]
    : [];

  return (
    <div className={`app ${condition} ${isNight ? "night" : "day"}`}>
      <Scene
        condition={condition}
        isNight={isNight}
        wind={weather ? Number(weather.wind) / 3.6 : 0}
      />

      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <main
        className="card"
        ref={cardRef}
        onMouseMove={handleTilt}
        onMouseLeave={resetTilt}
      >
        <div className="card-glow" />
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            getWeather();
          }}
        >
          <input
            type="text"
            placeholder="Search city..."
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <button type="submit" disabled={loading} aria-label="Search">
            {loading ? <span className="spinner" /> : "➜"}
          </button>
          <button
            type="button"
            className={`sound-btn ${soundOn ? "on" : ""}`}
            onClick={() => setSoundOn((v) => !v)}
            aria-label={soundOn ? "Mute weather sound" : "Play weather sound"}
            title={soundOn ? "Mute" : "Sound on"}
          >
            {soundOn ? "🔊" : "🔇"}
          </button>
        </form>

        {weather ? (
          <div className="content" key={weather.name + weather.dt}>
            <div className="hero">
              <div>
                <h2 className="city">
                  {weather.name}
                  <span className="country">{weather.country}</span>
                </h2>
                <p className="date">{localDate}</p>
              </div>
              <div className="big-icon">
                {ICONS[condition][isNight ? "night" : "day"]}
              </div>
            </div>

            <div className="temp-row">
              <h1 className="temp">
                {animatedTemp}
                <span>°C</span>
              </h1>
              <div className="temp-meta">
                <p className="desc">{weather.desc}</p>
                <p>Feels like {extra.feelsLike}°</p>
                <p>
                  H {extra.tempMax}° · L {extra.tempMin}°
                </p>
              </div>
            </div>

            <div className="stats">
              {stats.map((s, i) => (
                <div
                  className="stat"
                  key={s.label}
                  style={{ animationDelay: `${0.25 + i * 0.06}s` }}
                >
                  <span className="stat-icon">{s.icon}</span>
                  <span className="stat-label">{s.label}</span>
                  <span className="stat-value">{s.value}</span>
                </div>
              ))}
            </div>

            {forecast.length > 0 && <Forecast days={forecast} />}
          </div>
        ) : (
          <div className="empty">
            <div className="big-icon">🌤️</div>
            <h2>Check the weather</h2>
            <p>Search any city to see live conditions.</p>
          </div>
        )}

        {!loading && (
          <div className="chips">
            {QUICK_CITIES.map((c, i) => (
              <button
                key={c}
                className="chip"
                style={{ animationDelay: `${0.4 + i * 0.07}s` }}
                onClick={() => {
                  setCity(c);
                  getWeather(c);
                }}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
