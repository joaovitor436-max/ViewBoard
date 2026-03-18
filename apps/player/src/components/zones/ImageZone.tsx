import { motion } from "framer-motion";

interface ImageZoneProps {
  url: string;
  alt?: string;
  objectFit?: "cover" | "contain" | "fill";
}

export function ImageZone({ url, alt = "", objectFit = "cover" }: ImageZoneProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      style={{ width: "100%", height: "100%" }}
    >
      <img
        src={url}
        alt={alt}
        style={{
          width: "100%",
          height: "100%",
          objectFit,
          display: "block",
        }}
      />
    </motion.div>
  );
}
