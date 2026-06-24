"use client";

import { useState } from "react";
import Button from "@/app/components/Button";
import ScheduleDate from "./ScheduleDate";
import ResponseDate from "./ReponseDate";

export default function PropuestaInteractiva() {
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    dateTime: "",
  });

  return (
    <>
      <div className="text-center mt-6 max-w-75 mx-auto">
        <Button
          label="AGENDAR ASESORÍA GRATUITA"
          variant="secondary"
          onClick={() => setIsScheduleModalOpen(true)}
        />
      </div>

      <ScheduleDate
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onSubmitSuccess={(data) => {
          setFormData(data);
          setIsScheduleModalOpen(false);
          setIsResponseModalOpen(true);
        }}
      />

      {isResponseModalOpen && (
        <ResponseDate
          isOpen={isResponseModalOpen}
          onClose={() => setIsResponseModalOpen(false)}
          fullName={formData.fullName}
          email={formData.email}
          dateTime={formData.dateTime}
        />
      )}
    </>
  );
}
