/**
 * Test Runner for useBackupRestore.createBackup Tests
 * 
 * This component provides a UI to run the createBackup tests.
 * Similar to runAsyncStorageTest.tsx
 */

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { runAllCreateBackupTests } from './useBackupRestore.createBackup.test';

export default function RunCreateBackupTest() {
  const [testOutput, setTestOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runTests = async () => {
    setIsRunning(true);
    setTestOutput([]);

    // Capture console.log output
    const originalLog = console.log;
    const originalError = console.error;
    const logs: string[] = [];

    console.log = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      logs.push(message);
      setTestOutput([...logs]);
      originalLog(...args);
    };

    console.error = (...args: any[]) => {
      const message = '❌ ' + args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      logs.push(message);
      setTestOutput([...logs]);
      originalError(...args);
    };

    try {
      await runAllCreateBackupTests();
    } catch (error) {
      console.error('Test execution failed:', error);
    } finally {
      // Restore original console functions
      console.log = originalLog;
      console.error = originalError;
      setIsRunning(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>useBackupRestore.createBackup Tests</Text>
      
      <TouchableOpacity
        style={[styles.button, isRunning && styles.buttonDisabled]}
        onPress={runTests}
        disabled={isRunning}
      >
        <Text style={styles.buttonText}>
          {isRunning ? 'Running Tests...' : 'Run Tests'}
        </Text>
      </TouchableOpacity>

      <ScrollView style={styles.outputContainer}>
        {testOutput.map((line, index) => (
          <Text key={index} style={styles.outputText}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  outputContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 8,
  },
  outputText: {
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 4,
  },
});
