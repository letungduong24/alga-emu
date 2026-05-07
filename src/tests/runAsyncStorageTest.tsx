/**
 * AsyncStorage Test Runner Component
 * 
 * This component can be temporarily added to the app to run AsyncStorage tests.
 * Usage: Import and render this component in your app to run the tests.
 */

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { runAllTests } from './asyncStoragePersistence.test';

export const AsyncStorageTestRunner: React.FC = () => {
  const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [testOutput, setTestOutput] = useState<string[]>([]);

  const runTests = async () => {
    setTestStatus('running');
    setTestOutput(['Running tests...']);

    // Capture console output
    const originalLog = console.log;
    const originalError = console.error;
    const logs: string[] = [];

    console.log = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      logs.push(message);
      originalLog(...args);
    };

    console.error = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      logs.push(`ERROR: ${message}`);
      originalError(...args);
    };

    try {
      await runAllTests();
      setTestStatus('success');
      setTestOutput(logs);
    } catch (error) {
      setTestStatus('error');
      setTestOutput([...logs, `\nFinal Error: ${error}`]);
    } finally {
      // Restore console
      console.log = originalLog;
      console.error = originalError;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AsyncStorage Persistence Test</Text>
      
      <TouchableOpacity 
        style={[
          styles.button, 
          testStatus === 'running' && styles.buttonDisabled
        ]} 
        onPress={runTests}
        disabled={testStatus === 'running'}
      >
        <Text style={styles.buttonText}>
          {testStatus === 'running' ? 'Running Tests...' : 'Run Tests'}
        </Text>
      </TouchableOpacity>

      {testStatus !== 'idle' && (
        <View style={[
          styles.statusContainer,
          testStatus === 'success' && styles.statusSuccess,
          testStatus === 'error' && styles.statusError,
        ]}>
          <Text style={styles.statusText}>
            {testStatus === 'success' && '✅ Tests Passed'}
            {testStatus === 'error' && '❌ Tests Failed'}
            {testStatus === 'running' && '⏳ Running...'}
          </Text>
        </View>
      )}

      <ScrollView style={styles.outputContainer}>
        {testOutput.map((line, index) => (
          <Text key={index} style={styles.outputText}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#999',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  statusContainer: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  statusSuccess: {
    backgroundColor: '#d4edda',
  },
  statusError: {
    backgroundColor: '#f8d7da',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  outputContainer: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 15,
  },
  outputText: {
    color: '#d4d4d4',
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 4,
  },
});
