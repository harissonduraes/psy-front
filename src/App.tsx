import React, { useState, useRef } from 'react';
import './App.css'; // Importa o CSS

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Pressione o botão para começar a falar.');
  const [transcriptionText, setTranscriptionText] = useState('');
  const [llmResponseText, setLlmResponseText] = useState('');
  const audioPlaybackRef = useRef(null); // Ref para o elemento <audio>
  const mediaRecorderRef = useRef(null); // Ref para a instância do MediaRecorder
  const audioChunksRef = useRef([]); // Ref para armazenar os pedaços de áudio

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop()); // Parar o microfone
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setStatusMessage('Gravando... Solte para enviar.');
      setTranscriptionText('');
      setLlmResponseText('');
      if (audioPlaybackRef.current) {
        audioPlaybackRef.current.src = ''; // Limpa áudio anterior
      }
    } catch (err) {
      console.error('Erro ao acessar o microfone:', err);
      setStatusMessage('Erro: Permissão de microfone negada ou indisponível.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatusMessage('Processando...');
    }
  };

  const processAudio = async (audioBlob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    try {
      const response = await fetch('http://127.0.0.1:5000/process_audio', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(`Erro do servidor: ${response.status} - ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      setTranscriptionText(`Você disse: "${data.transcription}"`);
      setLlmResponseText(`IA disse: "${data.llm_response}"`);

      if (audioPlaybackRef.current) {
        audioPlaybackRef.current.src = data.audio_data; // Data URL do áudio
        audioPlaybackRef.current.play();
      }
      setStatusMessage('Resposta da IA:');

    } catch (error) {
      console.error('Erro ao enviar áudio para o backend:', error);
      setStatusMessage(`Erro: ${error.message}`);
      setTranscriptionText('');
      setLlmResponseText('');
    }
  };

  return (
    <div className="container">
      <h1>Converse com seu Psicólogo IA</h1>
      <button
        id="recordButton"
        className={isRecording ? 'recording' : ''}
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
      >
        {isRecording ? 'Gravando...' : 'Pressione para Falar'}
      </button>
      <div id="status">{statusMessage}</div>
      {transcriptionText && <div id="transcription"><strong>Sua Fala:</strong> {transcriptionText}</div>}
      {llmResponseText && <div id="llmResponse"><strong>Resposta da IA:</strong> {llmResponseText}</div>}
      <audio ref={audioPlaybackRef} controls autoPlay></audio>
    </div>
  );
}

export default App;