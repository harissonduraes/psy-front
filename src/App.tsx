import { useState, useRef } from 'react';
import './App.css'; // Importa o CSS

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Pressione o botão para começar a falar.');
  const [transcriptionText, setTranscriptionText] = useState('');
  const [llmResponseText, setLlmResponseText] = useState('');

  // Ref para o elemento <audio>, tipado como HTMLAudioElement ou null
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);
  // Ref para a instância do MediaRecorder, tipado como MediaRecorder ou null
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  // Ref para armazenar os pedaços de áudio, tipado como um array de Blob
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Atribui a instância do MediaRecorder ao ref.
      // O tipo MediaRecorder | null já lida com a atribuição.
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = []; // Limpa os pedaços de áudio anteriores

      // Define o manipulador de evento para quando dados de áudio estão disponíveis.
      // O 'event' é tipado como BlobEvent.
      mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
        audioChunksRef.current.push(event.data);
      };

      // Define o manipulador de evento para quando a gravação é parada.
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop()); // Parar o microfone
      };

      // Inicia a gravação. mediaRecorderRef.current é garantidamente não nulo aqui.
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setStatusMessage('Gravando... Solte para enviar.');
      setTranscriptionText('');
      setLlmResponseText('');
      // Limpa o áudio anterior no player, se existir.
      // Adiciona verificação de null para audioPlaybackRef.current.
      if (audioPlaybackRef.current) {
        audioPlaybackRef.current.src = '';
      }
    } catch (err) {
      console.error('Erro ao acessar o microfone:', err);
      setStatusMessage('Erro: Permissão de microfone negada ou indisponível.');
    }
  };

  const stopRecording = () => {
    // Verifica se mediaRecorderRef.current não é null e se está gravando.
    // O TypeScript agora entende que mediaRecorderRef.current é MediaRecorder dentro deste if.
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop(); // Para a gravação
      setIsRecording(false);
      setStatusMessage('Processando...');
    }
  };

  // Função para processar o áudio, tipando audioBlob como Blob.
  const processAudio = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    try {
      const response = await fetch('https://back-psy.vercel.app/process_audio', {
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

      // Verifica se audioPlaybackRef.current não é null antes de acessar suas propriedades.
      if (audioPlaybackRef.current) {
        audioPlaybackRef.current.src = data.audio_data; // Data URL do áudio
        audioPlaybackRef.current.play(); // Toca o áudio
      }
      setStatusMessage('Resposta da IA:');

    } catch (error: unknown) { // Captura o erro como 'unknown' para tratamento seguro.
      console.error('Erro ao enviar áudio para o backend:', error);
      // Trata o erro de forma segura, verificando se é uma instância de Error.
      if (error instanceof Error) {
        setStatusMessage(`Erro: ${error.message}`);
      } else {
        setStatusMessage(`Erro desconhecido ao processar áudio.`);
      }
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
      {/* O elemento audio deve ter 'controls' e 'autoPlay' para funcionar como esperado */}
      <audio ref={audioPlaybackRef} controls autoPlay></audio>
    </div>
  );
}

export default App;