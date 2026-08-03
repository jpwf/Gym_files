import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  SafeAreaView,
  Image 
} from 'react-native';
import { api } from '../services/api';

export default function CardiosScreen() {
  const [minutes, setMinutes] = useState('');
  const [selectedType, setSelectedType] = useState('Esteira');
  const [loading, setLoading] = useState(false);

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

  const triggerCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
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

      Alert.alert('Sucesso!', `${minutes} min de ${selectedType} registrados!`);

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
      <View style={styles.content}>
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
          capture="environment"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <TouchableOpacity style={styles.uploadButton} onPress={triggerCamera}>
          <Text style={styles.uploadButtonText}>
            {photoFile ? 'Trocar Foto' : 'Tirar/Anexar Foto do Cardio'}
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20 },
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadButtonText: {
    color: '#0284c7',
    fontWeight: '600',
    fontSize: 15,
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
});