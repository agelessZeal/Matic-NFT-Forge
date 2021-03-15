import React, { useState } from "react";
import { Alert as Alert2, Row } from "react-bootstrap";

export default function Alert({ title, content, type, link }) {
  const [open, setOpen] = useState(true);

  return (
    open && (
      <Row className="justify-content-center">
        <Alert2
          className="w-50"
          variant={type}
          onClose={() => setOpen(false)}
          dismissible
        >
          {title && <Alert2.Heading>{title}</Alert2.Heading>}
          <p>{content}</p>
          {link && (
            <div>
              View your token details{" "}
              <a href={link} target="_blank">
                here
              </a>
            </div>
          )}
        </Alert2>
      </Row>
    )
  );
}
