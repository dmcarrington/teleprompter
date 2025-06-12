import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Video, ResizeMode } from 'expo-av';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';

interface Recording {
  id: string;
  uri: string;
  filename: string;
  creationTime: number;
  duration: number;
}

interface RecordingItemProps {
  item: Recording;
  isPlaying: boolean;
  onTogglePlayback: () => void;
  onDelete: () => void;
  onStop: () => void;
  formatDate: (timestamp: number) => string;
  formatDuration: (duration: number) => string;
}

function RecordingItem({
  item,
  isPlaying,
  onTogglePlayback,
  onDelete,
  onStop,
  formatDate,
  formatDuration,
}: RecordingItemProps) {
  return (
    <ThemedView style={styles.recordingItem}>
      <View style={styles.videoContainer}>
        {isPlaying ? (
          <Video
            source={{ uri: item.uri }}
            style={styles.video}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            onPlaybackStatusUpdate={(status: any) => {
              if (status.isLoaded && status.didJustFinish) {
                onStop();
              }
            }}
          />
        ) : (
          <TouchableOpacity
            style={styles.videoThumbnail}
            onPress={onTogglePlayback}
          >
            <IconSymbol name="play.circle.fill" size={48} color="#007AFF" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.recordingInfo}>
        <ThemedText style={styles.recordingTitle} numberOfLines={1}>
          {item.filename}
        </ThemedText>
        <ThemedText style={styles.recordingMeta}>
          {formatDate(item.creationTime)} • {formatDuration(item.duration)}
        </ThemedText>
      </View>

      <View style={styles.recordingActions}>
        {isPlaying ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onStop}
          >
            <IconSymbol name="stop.fill" size={20} color="#FF9500" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onTogglePlayback}
          >
            <IconSymbol name="play.fill" size={20} color="#007AFF" />
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onDelete}
        >
          <IconSymbol name="trash" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

export default function RecordingsScreen() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [videoPlayers, setVideoPlayers] = useState<{ [key: string]: any }>({});

  useEffect(() => {
    requestPermissionAndLoadRecordings();
  }, []);

  const requestPermissionAndLoadRecordings = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    setHasPermission(status === 'granted');
    
    if (status === 'granted') {
      loadRecordings();
    }
  };

  const loadRecordings = async () => {
    try {
      const media = await MediaLibrary.getAssetsAsync({
        mediaType: 'video',
        sortBy: 'creationTime',
        first: 100,
      });

      const videoRecordings: Recording[] = media.assets.map(asset => ({
        id: asset.id,
        uri: asset.uri,
        filename: asset.filename,
        creationTime: asset.creationTime,
        duration: asset.duration,
      }));

      setRecordings(videoRecordings);
    } catch (error) {
      console.error('Error loading recordings:', error);
    }
  };

  const deleteRecording = (recordingId: string) => {
    Alert.alert(
      'Delete Recording',
      'Are you sure you want to delete this recording?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await MediaLibrary.deleteAssetsAsync([recordingId]);
              setRecordings(recordings.filter(r => r.id !== recordingId));
            } catch (error) {
              console.error('Error deleting recording:', error);
              Alert.alert('Error', 'Failed to delete recording');
            }
          },
        },
      ]
    );
  };

  const formatDuration = (duration: number) => {
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const togglePlayback = (recordingId: string) => {
    if (playingVideo === recordingId) {
      setPlayingVideo(null);
    } else {
      setPlayingVideo(recordingId);
    }
  };

  const renderRecording = ({ item }: { item: Recording }) => (
    <RecordingItem
      item={item}
      isPlaying={playingVideo === item.id}
      onTogglePlayback={() => togglePlayback(item.id)}
      onDelete={() => deleteRecording(item.id)}
      onStop={() => setPlayingVideo(null)}
      formatDate={formatDate}
      formatDuration={formatDuration}
    />
  );

  if (hasPermission === null) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Requesting permissions...</ThemedText>
      </ThemedView>
    );
  }

  if (hasPermission === false) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.emptyState}>
          <IconSymbol name="exclamationmark.triangle" size={64} color="#FF9500" />
          <ThemedText style={styles.emptyText}>Permission Required</ThemedText>
          <ThemedText style={styles.emptySubtext}>
            Media library access is required to view recordings
          </ThemedText>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermissionAndLoadRecordings}
          >
            <ThemedText style={styles.permissionButtonText}>Grant Permission</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Recordings</ThemedText>
        <TouchableOpacity style={styles.refreshButton} onPress={loadRecordings}>
          <IconSymbol name="arrow.clockwise" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {recordings.length === 0 ? (
        <View style={styles.emptyState}>
          <IconSymbol name="video" size={64} color="#999" />
          <ThemedText style={styles.emptyText}>No recordings yet</ThemedText>
          <ThemedText style={styles.emptySubtext}>
            Record videos using the teleprompter to see them here
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={recordings}
          renderItem={renderRecording}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
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
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    padding: 20,
  },
  recordingItem: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    alignItems: 'center',
  },
  videoContainer: {
    width: 80,
    height: 60,
    backgroundColor: '#000',
    borderRadius: 8,
    margin: 12,
    overflow: 'hidden',
  },
  video: {
    flex: 1,
  },
  videoThumbnail: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  recordingInfo: {
    flex: 1,
    paddingVertical: 12,
  },
  recordingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  recordingMeta: {
    fontSize: 12,
    color: '#666',
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
});
