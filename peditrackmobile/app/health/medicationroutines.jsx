import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as FileSystem from "expo-file-system";
import NetInfo from "@react-native-community/netinfo";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Video } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import SubHeader from "../../components/SubScreenHeader";
import { useGlobalContext } from "../../context/GlobalProvider";
import { db } from "../../lib/firebase";

const medicationFilePath = `${FileSystem.documentDirectory}medicationRecords.json`;

export default function MedicationRoutinesScreen() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false); // State to track refreshing
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(false);
  const videoRef = React.useRef(null);

  const { user, currentBaby } = useGlobalContext();

  // Fetch medication data from local storage or Firebase
  const fetchMedicationData = async () => {
    setLoading(true);
    let localRecords = [];

    try {
      const fileExists = await FileSystem.getInfoAsync(medicationFilePath);
      if (fileExists.exists) {
        const fileContent = await FileSystem.readAsStringAsync(medicationFilePath);
        localRecords = JSON.parse(fileContent).filter(
          (record) => record.userMail === user.email && record.babyName === currentBaby
        );
      }

      const netInfo = await NetInfo.fetch();
      if (netInfo.isConnected) {
        const medicationQuery = query(
          collection(db, "medicationRoutines"),
          where("userMail", "==", user.email),
          where("babyName", "==", currentBaby)
        );
        const querySnapshot = await getDocs(medicationQuery);
        const firebaseRecords = querySnapshot.docs.map((doc) => doc.data());

        // Merge Firebase and local records
        const combinedRecords = [...localRecords, ...firebaseRecords].filter(
          (v, i, a) => a.findIndex((t) => t.ID === v.ID) === i // Remove duplicates by ID
        );
        setMedications(combinedRecords);
      } else {
        setMedications(localRecords);
      }
    } catch (error) {
      Alert.alert("Error", `Failed to fetch medication data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedicationData();
  }, []);

  // Toggle video playback
  const togglePlayback = () => {
    if (isPlaying) {
      videoRef.current.pauseAsync();
    } else {
      videoRef.current.playAsync();
    }
    setIsPlaying(!isPlaying);
  };

  // Function to handle when the video playback ends
  const handlePlaybackStatusUpdate = (status) => {
    if (status.didJustFinish) {
      videoRef.current.replayAsync();
      setIsPlaying(true); // Optionally set the play button to 'pause' state if you want it to play immediately
    }
  };

  // Function to handle refreshing
  const onRefresh = () => {
    setIsRefreshing(true);
    fetchMedicationData().then(() => {
      setIsRefreshing(false); // Stop refreshing after data is fetched
    });
  };

  // Function to find the nearest future routine time
  const getNextDoseTime = (routine) => {
    const currentTime = new Date();
    const futureTimes = routine
      .map((item) => new Date(item.mainAlarm))
      .filter((time) => time > currentTime); // Filter out past times

    if (futureTimes.length === 0) return "No upcoming doses";

    // Get the nearest future time
    const nextDoseTime = futureTimes.reduce((prev, curr) =>
      curr < prev ? curr : prev
    );

    return nextDoseTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        {/* Header */}
        <SubHeader title="Medication Routines" goBackPath={"/health"} />

        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ padding: 20 }}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing} // Controls the refreshing indicator
                onRefresh={onRefresh} // Calls the refresh function when pulled down
              />
            }
          >
            {/* Video Card with Overlayed Play/Pause Button */}
            <View style={styles.card}>
              <Video
                ref={videoRef}
                source={require("../../assets/video/medicatiovideo.mp4")}
                style={styles.video}
                resizeMode="cover"
                shouldPlay={false}
                onPlaybackStatusUpdate={handlePlaybackStatusUpdate} // Detect when video ends
              />
              <TouchableOpacity onPress={togglePlayback} style={styles.playButton}>
                <Ionicons
                  name={isPlaying ? "pause-circle" : "play-circle"}
                  size={50}
                  color="purple" // Purple color for play/pause button
                />
              </TouchableOpacity>
            </View>

            {/* Video Name */}
            <Text style={styles.videoName}>
              How to give medicine to a child using an oral syringe
            </Text>

            <Text style={styles.sectionTitle}>Current Medication</Text>

            {loading ? (
              <ActivityIndicator size="large" color="#6256B1" />
            ) : (
              medications.map((medication) => (
                <TouchableOpacity
                  key={medication.ID}
                  style={styles.medicationCard}
                  onPress={() =>
                    router.push({
                      pathname: "/health/medicationdetails",
                      params: { ...medication },
                    })
                  }
                >
                  {/* Notification Icon */}
                  <Ionicons
                    name="notifications-outline"
                    size={24}
                    color="gray"
                    style={styles.notificationIcon}
                  />
                  {/* Card Title on Top Left */}
                  <Text style={styles.medicationTitle}>{medication.title}</Text>
                  <View style={styles.medicationContent}>
                    <Image
                      source={{ uri: medication.imageUri || "https://via.placeholder.com/150" }}
                      style={styles.medicationImage}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.medicationDescription}>
                        {medication.description}
                      </Text>
                      <Text style={styles.medicationNextDose}>
                        Next Dose: {getNextDoseTime(medication.routine)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              router.push("/health/medicationform");
            }}
          >
            <Text style={styles.addButtonText}>Add New Routine</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5, // Elevation for Android shadow
    marginBottom: 20,
    position: "relative", // For overlay positioning
  },
  video: {
    width: "100%",
    height: 250, // Increased height for video card
  },
  playButton: {
    position: "absolute",
    top: "40%", // Center the button vertically
    left: "45%", // Center the button horizontally
  },
  videoName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "gray",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#6256B1",
  },
  medicationCard: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
    position: "relative", // To position notification icon
  },
  medicationTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10, // Give some spacing between title and image
  },
  medicationContent: {
    flexDirection: "row", // Image and text side by side
  },
  medicationImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 15,
  },
  medicationDescription: {
    fontSize: 14,
    color: "black",
    marginVertical: 5,
  },
  medicationNextDose: {
    fontSize: 14,
    color: "black",
  },
  notificationIcon: {
    position: "absolute",
    top: 10, // Push to top of the card
    right: 10, // Align right in the card
  },
  addButton: {
    backgroundColor: "#6256B1",
    padding: 5,
    borderRadius: 10,
    alignItems: "center",
    margin: 20,
  },
  addButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
});