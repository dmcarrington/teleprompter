import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';

interface Script {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  wordCount: number;
}

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

export default function TeleprompterScreen() {
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasAudioPermission, setHasAudioPermission] = useState<boolean | null>(null);
  const [hasMediaLibraryPermission, setHasMediaLibraryPermission] = useState<boolean | null>(null);
  const [scrollSpeed, setScrollSpeed] = useState(2);
  const [fontSize, setFontSize] = useState(24);
  const [isScrolling, setIsScrolling] = useState(false);
  
  const cameraRef = useRef<CameraView>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollAnimation = useRef(new Animated.Value(0)).current;
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

  useEffect(() => {
    requestPermissions();
    loadSelectedScript();
  }, []);

  useEffect(() => {
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, []);

  // Reload selected script when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadSelectedScript();
    }, [])
  );

  const requestPermissions = async () => {
    const cameraStatus = await requestCameraPermission();
    const audioStatus = await requestMicrophonePermission();
    const mediaLibraryStatus = await MediaLibrary.requestPermissionsAsync();
    
    setHasCameraPermission(cameraStatus?.granted || false);
    setHasAudioPermission(audioStatus?.granted || false);
    setHasMediaLibraryPermission(mediaLibraryStatus.status === 'granted');
  };

  const loadSelectedScript = async () => {
    try {
      const script = await AsyncStorage.getItem('selected_script');
      if (script) {
        setSelectedScript(JSON.parse(script));
      }
    } catch (error) {
      console.error('Error loading selected script:', error);
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current) return;
    
    try {
      setIsRecording(true);
      const video = await cameraRef.current.recordAsync({
        maxDuration: 600, // 10 minutes max
      });
      
      if (video && hasMediaLibraryPermission) {
        await MediaLibrary.saveToLibraryAsync(video.uri);
        Alert.alert('Success', 'Video saved to gallery!');
      }
    } catch (error) {
      console.error('Error recording video:', error);
      Alert.alert('Error', 'Failed to record video');
    } finally {
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
    }
  };

  const startAutoScroll = () => {
    if (!selectedScript || isScrolling) return;
    
    setIsScrolling(true);
    let scrollPosition = 0;
    
    scrollIntervalRef.current = setInterval(() => {
      scrollPosition += scrollSpeed;
      scrollViewRef.current?.scrollTo({ y: scrollPosition, animated: true });
    }, 50);
  };

  const stopAutoScroll = () => {
    setIsScrolling(false);
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  const resetScroll = () => {
    stopAutoScroll();
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  if (hasCameraPermission === null || hasAudioPermission === null) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Requesting permissions...</ThemedText>
      </ThemedView>
    );
  }

  if (hasCameraPermission === false || hasAudioPermission === false) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.permissionText}>
          Camera and microphone permissions are required for recording
        </ThemedText>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermissions}>
          <ThemedText style={styles.permissionButtonText}>Grant Permissions</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  if (!selectedScript) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.emptyState}>
          <IconSymbol name="doc.text" size={64} color="#999" />
          <ThemedText style={styles.emptyText}>No Script Selected</ThemedText>
          <ThemedText style={styles.emptySubtext}>
            Go to Scripts tab to select a script for teleprompter
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Main Content Area */}
      <View style={styles.mainContent}>
        {/* Script Content */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.scriptContainer}
          contentContainerStyle={styles.scriptContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.scriptText, { fontSize }]}>
            {selectedScript.content}
          </Text>
          <View style={styles.scriptPadding} />
        </ScrollView>
      </View>

      {/* Floating Camera Preview - Portrait on Right Side */}
      <View style={styles.floatingCameraContainer}>
        <CameraView
          style={styles.camera}
          facing="front"
          ref={cameraRef}
        />
        <View style={styles.cameraOverlay}>
          <ThemedText style={styles.scriptTitle}>{selectedScript.title}</ThemedText>
          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <ThemedText style={styles.recordingText}>REC</ThemedText>
            </View>
          )}
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        {/* Speed and Font Controls */}
        <View style={styles.settingsRow}>
          <View style={styles.settingGroup}>
            <ThemedText style={styles.settingLabel}>Speed</ThemedText>
            <View style={styles.settingButtons}>
              <TouchableOpacity
                style={styles.settingButton}
                onPress={() => setScrollSpeed(Math.max(1, scrollSpeed - 1))}
              >
                <ThemedText style={styles.settingButtonText}>-</ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.settingValue}>{scrollSpeed}</ThemedText>
              <TouchableOpacity
                style={styles.settingButton}
                onPress={() => setScrollSpeed(Math.min(10, scrollSpeed + 1))}
              >
                <ThemedText style={styles.settingButtonText}>+</ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.settingGroup}>
            <ThemedText style={styles.settingLabel}>Font</ThemedText>
            <View style={styles.settingButtons}>
              <TouchableOpacity
                style={styles.settingButton}
                onPress={() => setFontSize(Math.max(16, fontSize - 2))}
              >
                <ThemedText style={styles.settingButtonText}>-</ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.settingValue}>{fontSize}</ThemedText>
              <TouchableOpacity
                style={styles.settingButton}
                onPress={() => setFontSize(Math.min(36, fontSize + 2))}
              >
                <ThemedText style={styles.settingButtonText}>+</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Main Controls */}
        <View style={styles.mainControls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={resetScroll}
          >
            <IconSymbol name="arrow.up" size={24} color="#007AFF" />
          </TouchableOpacity>

          {isScrolling ? (
            <TouchableOpacity
              style={[styles.controlButton, styles.pauseButton]}
              onPress={stopAutoScroll}
            >
              <IconSymbol name="pause.fill" size={24} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.controlButton, styles.playButton]}
              onPress={startAutoScroll}
            >
              <IconSymbol name="play.fill" size={24} color="#fff" />
            </TouchableOpacity>
          )}

          {isRecording ? (
            <TouchableOpacity
              style={[styles.controlButton, styles.stopButton]}
              onPress={stopRecording}
            >
              <IconSymbol name="stop.fill" size={24} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.controlButton, styles.recordButton]}
              onPress={startRecording}
            >
              <IconSymbol name="record.circle" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  mainContent: {
    flex: 1,
    paddingRight: 140, // Make space for floating camera
  },
  floatingCameraContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 120,
    height: 160, // Portrait aspect ratio (3:4)
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    elevation: 8, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: 8,
  },
  scriptTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    alignSelf: 'flex-start',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,0,0,0.9)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    alignSelf: 'flex-end',
  },
  recordingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginRight: 2,
  },
  recordingText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#fff',
  },
  scriptContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scriptContent: {
    paddingVertical: 20,
  },
  scriptText: {
    lineHeight: 36,
    textAlign: 'center',
    color: '#000',
    fontSize: 24,
  },
  scriptPadding: {
    height: screenHeight,
  },
  controlsContainer: {
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  settingGroup: {
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  settingButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  settingValue: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 16,
    minWidth: 24,
    textAlign: 'center',
  },
  mainControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    backgroundColor: '#4CD964',
  },
  pauseButton: {
    backgroundColor: '#FF9500',
  },
  recordButton: {
    backgroundColor: '#FF3B30',
  },
  stopButton: {
    backgroundColor: '#8E8E93',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 20,
    color: '#999',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  permissionText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 40,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
