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
import { Image } from 'expo-image';
import { CameraView, CameraType, useCameraPermissions, useMicrophonePermissions, Camera, CameraRecordingOptions } from 'expo-camera';
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
  const [cameraReady, setCameraReady] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<string>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [cameraKey, setCameraKey] = useState(0);
  
  const cameraRef = useRef<CameraView>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollAnimation = useRef(new Animated.Value(0)).current;
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartTime = useRef<number>(0);

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
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  // Reload selected script and reset camera when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadSelectedScript();
      // Reset camera state when tab comes into focus
      setCameraReady(false);
      setRecordingStatus('idle');
      setIsRecording(false);
      setRecordingDuration(0);
      
      // Force camera remount by changing key
      setCameraKey(prev => prev + 1);
      
      // Stop any ongoing recording timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      return () => {
        // Cleanup when leaving the tab
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      };
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

  const onCameraReady = () => {
    console.log('Camera is ready');
    setCameraReady(true);
  };

  const startRecordingTimer = () => {
    recordingStartTime.current = Date.now();
    setRecordingDuration(0);
    recordingTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - recordingStartTime.current;
      setRecordingDuration(elapsed);
    }, 100);
  };

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const startRecording = async () => {
    console.log('=== Starting recording process ===');
    
    if (!cameraRef.current) {
      Alert.alert('Error', 'Camera not ready');
      return;
    }
    
    if (!hasCameraPermission || !hasAudioPermission) {
      Alert.alert('Error', 'Camera and microphone permissions required');
      return;
    }
    
    if (!hasMediaLibraryPermission) {
      Alert.alert('Error', 'Media library permission required');
      return;
    }

    if (!cameraReady) {
      Alert.alert('Error', 'Camera is not ready. Please wait a moment and try again.');
      return;
    }
    
    try {
      setIsRecording(true);
      setRecordingStatus('recording');
      startRecordingTimer();
      
      console.log('Starting camera recording...');
      
      // Start recording with a very simple approach

      const video = await cameraRef.current.recordAsync({codec: 'avc1', maxDuration: 60, maxFileSize: 100 * 1024 * 1024 /* 100 MB */});
        //maxDuration: 30, // Start with shorter duration for testing
    
      
      console.log('Recording completed:', video);
      stopRecordingTimer();
      setRecordingStatus('saving');
      
      if (video && video.uri) {
        try {
          await MediaLibrary.saveToLibraryAsync(video.uri);
          console.log('Video saved successfully');
          Alert.alert('Success', 'Video saved to gallery!');
          setRecordingStatus('saved');
        } catch (saveError) {
          console.error('Error saving video:', saveError);
          Alert.alert('Error', 'Failed to save video to gallery');
          setRecordingStatus('error');
        }
      } else {
        console.error('No video data received');
        Alert.alert('Error', 'No video data was recorded');
        setRecordingStatus('error');
      }
      
      setIsRecording(false);
      setRecordingDuration(0);
      setTimeout(() => setRecordingStatus('idle'), 2000);
      
    } catch (error) {
      console.error('Recording error:', error);
      stopRecordingTimer();
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error details:', errorMessage);
      
      let userMessage = 'Failed to record video';
      if (errorMessage.includes('stopped before any data')) {
        userMessage = 'Recording failed - this may be a simulator limitation. Try on a real device.';
      }
      
      Alert.alert('Recording Error', userMessage);
      setIsRecording(false);
      setRecordingDuration(0);
      setRecordingStatus('error');
      setTimeout(() => setRecordingStatus('idle'), 2000);
    }
  };

  const stopRecording = async () => {
    console.log('=== Stopping recording ===');
    
    if (cameraRef.current && isRecording) {
      try {
        console.log('Calling stopRecording on camera...');
        await cameraRef.current.stopRecording();
        console.log('Recording stopped successfully');
      } catch (error) {
        console.error('Error stopping recording:', error);
        stopRecordingTimer();
        setIsRecording(false);
        setRecordingDuration(0);
        setRecordingStatus('error');
        setTimeout(() => setRecordingStatus('idle'), 2000);
      }
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
          key={cameraKey}
          mode="video"
          style={styles.camera}
          facing="front"
          ref={cameraRef}
          onCameraReady={onCameraReady}
        />
        <View style={styles.cameraOverlay}>
          <ThemedText style={styles.scriptTitle}>{selectedScript.title}</ThemedText>
          
          {/* Status indicator */}
          {recordingStatus !== 'idle' && recordingStatus !== 'recording' && (
            <View style={styles.statusIndicator}>
              <ThemedText style={styles.statusText}>{recordingStatus.toUpperCase()}</ThemedText>
            </View>
          )}

          {/* Recording indicator */}
          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <ThemedText style={styles.recordingText}>REC</ThemedText>
              <ThemedText style={styles.recordingTime}>
                {Math.floor(recordingDuration / 1000)}s
              </ThemedText>
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
            <Image
                source={require('@/assets/images/home.svg')}
                style={styles.recordIcon}
                contentFit="contain"
              />
          </TouchableOpacity>

          {isScrolling ? (
            <TouchableOpacity
              style={[styles.controlButton, styles.pauseButton]}
              onPress={stopAutoScroll}
            >
             <Image
                source={require('@/assets/images/up-arrow.svg')}
                style={styles.recordIcon}
                contentFit="contain"
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.controlButton, styles.playButton]}
              onPress={startAutoScroll}
            >
              <Image
                source={require('@/assets/images/up-arrow.svg')}
                style={styles.recordIcon}
                contentFit="contain"
              />
            </TouchableOpacity>
          )}

          {isRecording ? (
            <TouchableOpacity
              style={[styles.controlButton, styles.stopButton]}
              onPress={stopRecording}
            >
              <Image
                source={require('@/assets/images/video.svg')}
                style={styles.recordIcon}
                contentFit="contain"
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.controlButton, styles.recordButton]}
              onPress={startRecording}
              disabled={recordingStatus !== 'idle'}
            >
             <Image
                source={require('@/assets/images/video.svg')}
                style={styles.recordIcon}
                contentFit="contain"
              />
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
    paddingTop:60,
  },
  mainContent: {
    flex: 1,
    paddingRight: 140, // Make space for floating camera
  },
  floatingCameraContainer: {
    position: 'absolute',
    top: 60,
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
  recordingTime: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 4,
  },
  statusIndicator: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    alignSelf: 'center',
  },
  statusText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#fff',
  },
  scriptContainer: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: '#000',
  },
  scriptContent: {
    paddingVertical: 20,
    backgroundColor: '#000',
  },
  scriptText: {
    lineHeight: 36,
    textAlign: 'center',
    color: '#fff',
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
    color: '#333',
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
    color: '#333',
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
  recordIcon: {
    width: 24,
    height: 24,
    tintColor: '#fff',
  },
});
