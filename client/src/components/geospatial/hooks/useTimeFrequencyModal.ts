import { useState } from 'react';

type TimeFreqPayload = {
  bssid: string;
  ssid: string;
};

export const useTimeFrequencyModal = () => {
  const [timeFreqModal, setTimeFreqModal] = useState<TimeFreqPayload | null>(null);

  const openTimeFrequency = (payload: TimeFreqPayload | null) => {
    setTimeFreqModal(payload);
  };

  const closeTimeFrequency = () => setTimeFreqModal(null);

  return {
    timeFreqModal,
    openTimeFrequency,
    closeTimeFrequency,
    setTimeFreqModal,
  };
};
