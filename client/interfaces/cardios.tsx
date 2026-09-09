import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  SafeAreaView,
  Image,
  ScrollView,
  Modal
} from 'react-native';
import { api } from '../services/api';

export default function CardiosScreen() {
  const [minutes, setMinutes] = useState('');
  const [selectedType, setSelectedType] = useState('Esteira');
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSourceModal, setShowSourceModal] = useState(false);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const cardioTypes = ['Esteira', 'Corrida Rua', 'Bicicleta', 'Escada', 'Natação'];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isBlockedExtension = fileName.endsWith('.gif');

    if (!file.type.startsWith('image/')) {
      Alert.alert('Arquivo inválido', 'Selecione apenas arquivos de imagem.');
      return;
    }

    if (isBlockedExtension) {
      Alert.alert('Arquivo não permitido', 'Este tipo de arquivo não pode ser enviado.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      Alert.alert('Arquivo muito grande', 'A foto deve ter no máximo 5MB.');
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const triggerFilePicker = (mode: 'camera' | 'gallery' = 'gallery') => {
    if (!fileInputRef.current) return;

    if (mode === 'camera') {
      fileInputRef.current.setAttribute('capture', 'environment');
    } else {
      fileInputRef.current.removeAttribute('capture');
    }

    setShowSourceModal(false);
    fileInputRef.current.click();
  };

  const handleRegister = async () => {
    if (!minutes) {
      Alert.alert('Atenção', 'Informe a quantidade de minutos.');
      return;
    }

    if (!photoFile) {
      Alert.alert('Comprovante obrigatório', 'Tire ou anexe uma foto para validar seu cardio.');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
        formData.append('tipo', selectedType);
        formData.append('duracao_min', minutes);
        formData.append('data', new Date().toISOString());

       
        if (photoFile) {
          formData.append('foto', photoFile, photoFile.name || 'cardio.jpg');
        }

      await api.post('/cardios', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          transformRequest: (data, headers) => {
            // Apaga o Content-Type manual para que o navegador/Axios recrie com o boundary correto!
            delete headers['Content-Type'];
            return data;
          },
        });

      setSuccessMessage(`${minutes} min de ${selectedType} registrados!`);
      setShowSuccessModal(true);

      setMinutes('');
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Não foi possível salvar o cardio.';
      Alert.alert('Erro', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Registrar Cardio</Text>

        <Text style={styles.label}>Duração (em minutos):</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: 45"
          keyboardType="numeric"
          value={minutes}
          onChangeText={setMinutes}
        />

        <Text style={styles.label}>Tipo de Cardio:</Text>
        <View style={styles.chipContainer}>
          {cardioTypes.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.chip, selectedType === type && styles.chipActive]}
              onPress={() => setSelectedType(type)}
            >
              <Text style={[styles.chipText, selectedType === type && styles.chipTextActive]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Comprovante (Foto):</Text>

        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <TouchableOpacity
          style={styles.uploadButtonSingle}
          onPress={() => setShowSourceModal(true)}
        >
          <Text style={styles.uploadButtonTextSingle}>
            {photoFile ? 'Trocar comprovante' : 'Selecionar comprovante'}
          </Text>
        </TouchableOpacity>

        {photoPreview && (
          <View style={styles.previewContainer}>
            <Image source={{ uri: photoPreview }} style={styles.previewImage} />
            <Text style={styles.previewText}>{photoFile?.name}</Text>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleRegister} 
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Enviando...' : 'Salvar Cardio'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        transparent
        visible={showSourceModal}
        animationType="fade"
        onRequestClose={() => setShowSourceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecionar comprovante</Text>
            <TouchableOpacity
              style={[styles.modalChoiceButton, styles.primaryButton]}
              onPress={() => triggerFilePicker('camera')}
            >
              <Text style={styles.modalChoiceText}>Tirar foto</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalChoiceButton, styles.secondaryButton]}
              onPress={() => triggerFilePicker('gallery')}
            >
              <Text style={[styles.modalChoiceText, styles.secondaryButtonText]}>Escolher da galeria</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={showSuccessModal}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Registro concluído!</Text>
            <Text style={styles.modalText}>{successMessage}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 32,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#0f172a', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  fileActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  uploadButtonSingle: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  uploadButtonTextSingle: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  chipActive: { backgroundColor: '#2563eb' },
  chipText: { fontSize: 14, color: '#475569', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: 'bold' },
  
  uploadButton: {
    flex: 1,
    minWidth: 140,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
  },
  secondaryButton: {
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  secondaryButtonText: {
    color: '#0f172a',
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  previewText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
  },

  button: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 16,
    color: '#334155',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalChoiceButton: {
    width: '100%',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  modalChoiceText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});