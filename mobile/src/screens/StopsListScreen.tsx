import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'StopsList'> };

export default function StopsListScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backIcon}>â†</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Edit stop</Text>
        <TouchableOpacity><Text style={styles.doneText}>Done</Text></TouchableOpacity>
      </View>
      
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>ID-PENDING</Text>
          <Text style={styles.addressTitle}>Calle 166 #9-24</Text>
          <Text style={styles.addressSub}>Villa de Aranjuez, UsaquÃ©n, 110131</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, backgroundColor: Colors.surface },
  backIcon: { fontSize: 24, color: Colors.textPrimary },
  headerTitle: { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: Colors.textPrimary },
  doneText: { fontSize: Typography.size.md, color: Colors.primary, fontWeight: Typography.weight.semibold },
  content: { padding: Spacing.lg },
  card: { backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: Radius.lg, ...Shadows.soft },
  label: { color: Colors.textSecondary, fontSize: Typography.size.xs, fontWeight: 'bold', letterSpacing: 1 },
  addressTitle: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold, color: Colors.textPrimary, marginTop: Spacing.sm },
  addressSub: { fontSize: Typography.size.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
});