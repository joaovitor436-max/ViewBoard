import { useState, useEffect } from "react";
import type { WeatherData } from "@viewboard/shared";

interface WeatherZoneProps {
  city?: string;
  apiUrl?: string;
  screenToken?: string;
}

export function WeatherZone({
  city = "São Paulo",
  apiUrl = import.meta.env["VITE_API_URL"] ?? "http://localhost:3001",
  screenToken,
}: WeatherZoneProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchWeather() {
      try {
        const res = await fetch(
          `${apiUrl}/api/v1/integrations/weather?city=${encodeURIComponent(city)}`,
          {
            headers: screenToken
              ? { Authorization: `Bearer ${screenToken}` }
              : {},
          }
        );
        if (!res.ok) throw new Error("Failed to fetch weather");
        const data = await res.json();
        if (active) setWeather(data.data as WeatherData);
      } catch (err) {
        if (active) setError("Weather unavailable");
      }
    }

    fetchWeather();
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [city, apiUrl, screenToken]);

  if (error) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.8)",
          color: "#aaa",
          fontSize: "1rem",
        }}
      >
        {error}
      </div>
    );
  }

  if (!weather) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "rgba(0,0,0,0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #1e3a5f, #2980b9)",
        color: "white",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ fontSize: "clamp(1rem, 3vw, 1.5rem)", opacity: 0.9 }}>
        {weather.city}, {weather.country}
      </div>
      <div
        style={{
          fontSize: "clamp(3rem, 10vw, 6rem)",
          fontWeight: "bold",
          lineHeight: 1,
        }}
      >
        {weather.temperature}°C
      </div>
      <div style={{ fontSize: "clamp(0.75rem, 2vw, 1rem)", opacity: 0.8 }}>
        {weather.description}
      </div>
      <div style={{ fontSize: "clamp(0.6rem, 1.5vw, 0.875rem)", opacity: 0.6, marginTop: "0.25rem" }}>
        Feels like {weather.feelsLike}°C · Humidity {weather.humidity}%
      </div>
    </div>
  );
}
