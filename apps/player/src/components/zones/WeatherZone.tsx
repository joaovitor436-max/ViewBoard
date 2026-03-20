import type { WeatherData } from "@/hooks/useWidgets";

interface WeatherZoneProps {
  data?: WeatherData | null;
  unit?: "celsius" | "fahrenheit";
  // Legacy props for backward compatibility
  city?: string;
  apiUrl?: string;
  screenToken?: string;
}

export function WeatherZone({ data, unit = "celsius" }: WeatherZoneProps) {
  if (!data) {
    // Graceful degradation: hide widget entirely when no data
    return null;
  }

  const unitSymbol = unit === "fahrenheit" ? "F" : "C";
  const iconUrl = data.icon
    ? `https://openweathermap.org/img/wn/${data.icon}@2x.png`
    : null;

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
      <div style={{ fontSize: "clamp(0.75rem, 2vw, 1rem)", opacity: 0.9 }}>
        {data.city}, {data.country}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.25rem",
        }}
      >
        {iconUrl && (
          <img
            src={iconUrl}
            alt={data.description}
            style={{ width: "clamp(2.5rem, 8vw, 5rem)", height: "auto" }}
          />
        )}
        <div
          style={{
            fontSize: "clamp(2.5rem, 8vw, 5rem)",
            fontWeight: "bold",
            lineHeight: 1,
          }}
        >
          {data.temperature}°{unitSymbol}
        </div>
      </div>
      <div
        style={{
          fontSize: "clamp(0.6rem, 1.5vw, 0.875rem)",
          opacity: 0.8,
          textTransform: "capitalize",
        }}
      >
        {data.description}
      </div>
      <div
        style={{
          fontSize: "clamp(0.5rem, 1.2vw, 0.75rem)",
          opacity: 0.6,
          marginTop: "0.25rem",
        }}
      >
        Sensação {data.feelsLike}°{unitSymbol} · Umidade {data.humidity}%
      </div>

      {/* Forecast */}
      {data.forecast && data.forecast.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            marginTop: "0.5rem",
            fontSize: "clamp(0.45rem, 1vw, 0.65rem)",
            opacity: 0.7,
          }}
        >
          {data.forecast.map((f, i) => {
            const fIcon = f.icon
              ? `https://openweathermap.org/img/wn/${f.icon}.png`
              : null;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.1rem",
                }}
              >
                {fIcon && (
                  <img src={fIcon} alt="" style={{ width: "1.5rem", height: "auto" }} />
                )}
                <span>
                  {f.temperature}°{unitSymbol}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
