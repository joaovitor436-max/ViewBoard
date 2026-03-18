import { motion } from "framer-motion";

interface AnnouncementZoneProps {
  title?: string;
  body?: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: string;
}

export function AnnouncementZone({
  title,
  body,
  backgroundColor = "#1e40af",
  textColor = "#ffffff",
  fontSize = "clamp(1rem, 3vw, 2rem)",
}: AnnouncementZoneProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        width: "100%",
        height: "100%",
        background: backgroundColor,
        color: textColor,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {title && (
        <h2
          style={{
            fontSize,
            fontWeight: "bold",
            marginBottom: "0.75rem",
            lineHeight: 1.2,
          }}
        >
          {title}
        </h2>
      )}
      {body && (
        <p
          style={{
            fontSize: `calc(${fontSize} * 0.7)`,
            opacity: 0.9,
            maxWidth: "90%",
            lineHeight: 1.5,
          }}
        >
          {body}
        </p>
      )}
    </motion.div>
  );
}
