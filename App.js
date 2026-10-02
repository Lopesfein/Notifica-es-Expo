import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [delay, setDelay] = useState('10');
  const [permissionStatus, setPermissionStatus] = useState('undetermined');
  const [scheduledNotifications, setScheduledNotifications] = useState([]);
  const timeoutRefs = useRef({});

  const isNativeNotificationSupported = Platform.OS !== 'web';

  const loadScheduledNotifications = async () => {
    if (!isNativeNotificationSupported) {
      return;
    }

    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    setScheduledNotifications(
      notifications.map((item) => ({
        id: item.identifier,
        title: item.content?.title || 'Sem título',
        body: item.content?.body || 'Sem mensagem',
        seconds: item.trigger?.seconds ?? 0,
      }))
    );
  };

  useEffect(() => {
    const initialize = async () => {
      if (!isNativeNotificationSupported) {
        if ('Notification' in window) {
          setPermissionStatus(Notification.permission);
        } else {
          setPermissionStatus('unsupported');
        }
        return;
      }

      const status = await Notifications.getPermissionsAsync();
      setPermissionStatus(status.status);
      await loadScheduledNotifications();
    };

    initialize();

    return () => {
      Object.values(timeoutRefs.current).forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, []);

  const requestNotificationPermission = async () => {
    if (!isNativeNotificationSupported) {
      if (!('Notification' in window)) {
        Alert.alert('Navegador', 'Seu navegador não suporta notificações.');
        return false;
      }

      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);

      if (permission !== 'granted') {
        Alert.alert('Permissão necessária', 'O app precisa de autorização para enviar notificações no navegador.');
        return false;
      }

      return true;
    }

    const response = await Notifications.requestPermissionsAsync();
    setPermissionStatus(response.status);

    if (response.status !== 'granted') {
      Alert.alert('Permissão necessária', 'O app precisa de autorização para enviar notificações.');
      return false;
    }

    return true;
  };

  const handleSchedule = async () => {
    const trimmedTitle = title.trim();
    const trimmedMessage = message.trim();
    const parsedDelay = Number(delay);

    if (!trimmedTitle || !trimmedMessage) {
      Alert.alert('Campos obrigatórios', 'Informe um título e uma mensagem para o lembrete.');
      return;
    }

    if (!Number.isFinite(parsedDelay) || parsedDelay <= 0) {
      Alert.alert('Tempo inválido', 'Informe um valor maior que zero para o atraso.');
      return;
    }

    if (!isNativeNotificationSupported) {
      if (permissionStatus !== 'granted') {
        const granted = await requestNotificationPermission();
        if (!granted) return;
      }

      const id = `web-${Date.now()}`;
      const timeoutId = setTimeout(() => {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(trimmedTitle, { body: trimmedMessage });
        } else {
          Alert.alert(trimmedTitle, trimmedMessage);
        }

        setScheduledNotifications((current) => current.filter((item) => item.id !== id));
        delete timeoutRefs.current[id];
      }, parsedDelay * 1000);

      timeoutRefs.current[id] = timeoutId;

      setScheduledNotifications((current) => [
        {
          id,
          title: trimmedTitle,
          body: trimmedMessage,
          seconds: parsedDelay,
        },
        ...current,
      ]);

      Alert.alert('Lembrete agendado', `Será enviado em ${parsedDelay} segundo(s).`);
      setTitle('');
      setMessage('');
      setDelay('10');
      return;
    }

    let status = permissionStatus;
    if (status !== 'granted') {
      const granted = await requestNotificationPermission();
      if (!granted) return;
      status = 'granted';
    }

    if (status !== 'granted') {
      Alert.alert('Permissão não concedida');
      return;
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: trimmedTitle,
        body: trimmedMessage,
        sound: true,
      },
      trigger: {
        seconds: parsedDelay,
      },
    });

    Alert.alert('Lembrete agendado', `Identificador: ${identifier}`);
    setTitle('');
    setMessage('');
    setDelay('10');
    await loadScheduledNotifications();
  };

  const handleCancel = async (id) => {
    if (!isNativeNotificationSupported) {
      if (timeoutRefs.current[id]) {
        clearTimeout(timeoutRefs.current[id]);
        delete timeoutRefs.current[id];
      }

      setScheduledNotifications((current) => current.filter((item) => item.id !== id));
      return;
    }

    await Notifications.cancelScheduledNotificationAsync(id);
    await loadScheduledNotifications();
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>Lembretes</Text>
        <Text style={styles.subtitle}>Agende um aviso para o futuro.</Text>

        <View style={styles.permissionBox}>
          <Text style={styles.label}>Permissão</Text>
          <Text style={styles.permissionValue}>
            {permissionStatus === 'granted'
              ? 'Ativada'
              : permissionStatus === 'unsupported'
                ? 'Web não suporta'
                : 'Pendente'}
          </Text>
        </View>

        <TouchableOpacity style={styles.secondaryButton} onPress={requestNotificationPermission}>
          <Text style={styles.secondaryButtonText}>Solicitar permissão</Text>
        </TouchableOpacity>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Título</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ex.: Comprar pão"
            placeholderTextColor="#7b8d8c"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Mensagem</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={message}
            onChangeText={setMessage}
            placeholder="Ex.: Não esquecer de passar no mercado"
            placeholderTextColor="#7b8d8c"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Tempo de atraso (segundos)</Text>
          <TextInput
            style={styles.input}
            value={delay}
            onChangeText={setDelay}
            keyboardType="numeric"
            placeholder="10"
            placeholderTextColor="#7b8d8c"
          />
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleSchedule}>
          <Text style={styles.primaryButtonText}>Agendar lembrete</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Agendados</Text>

        {scheduledNotifications.length === 0 ? (
          <Text style={styles.emptyState}>Nenhum lembrete agendado.</Text>
        ) : (
          scheduledNotifications.map((item) => (
            <View key={item.id} style={styles.reminderCard}>
              <View style={styles.cardTextContent}>
                <Text style={styles.reminderTitle}>{item.title}</Text>
                <Text style={styles.reminderBody}>{item.body}</Text>
                <Text style={styles.reminderMeta}>Atraso: {item.seconds}s</Text>
              </View>

              <TouchableOpacity style={styles.cancelButton} onPress={() => handleCancel(item.id)}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#f3f5f4',
    paddingBottom: 32,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 48,
    maxWidth: 700,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1f2d2a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#5b6b6a',
    marginBottom: 20,
  },
  permissionBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe5e3',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3d3a',
  },
  permissionValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1d8b7a',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d9e0df',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a2927',
  },
  textArea: {
    minHeight: 96,
    paddingTop: 12,
  },
  primaryButton: {
    backgroundColor: '#045f6f',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 22,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#edf2f1',
    borderWidth: 1,
    borderColor: '#d5dedb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 18,
  },
  secondaryButtonText: {
    color: '#23332f',
    fontSize: 15,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2d2a',
    marginBottom: 10,
  },
  reminderCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe7e4',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTextContent: {
    flex: 1,
    marginRight: 10,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1d2928',
    marginBottom: 4,
  },
  reminderBody: {
    fontSize: 14,
    color: '#526562',
    marginBottom: 4,
  },
});
